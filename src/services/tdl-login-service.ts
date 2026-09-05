import { type ChildProcess, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { getSetting } from "@/services/config-service.js";
import { createLogger } from "@/services/logger.js";
import { resolveTdlBinaryPath } from "@/services/tdl-service.js";

const logger = createLogger("tdl-login");

export type TdlQrLoginStatus =
  | "idle"
  | "starting"
  | "qr_ready"
  | "waiting_password"
  | "success"
  | "failed"
  | "canceled";

export interface TdlQrSessionState {
  status: TdlQrLoginStatus;
  qrSvg?: string;
  error?: string;
  user?: {
    id?: number;
    username?: string;
  };
}

let activeProcess: ChildProcess | null = null;
let currentSession: TdlQrSessionState = {
  status: "idle",
};
let sessionTimeoutTimer: NodeJS.Timeout | null = null;

/**
 * 将终端输出的 Unicode 半块字符二维码转换为清晰的 SVG。
 */
export function textQrToSvg(qrText: string): string | null {
  const clean = qrText
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI escape sequences
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

  const lines = clean
    .split(/[\r\n]+/)
    .map(l => l.trimEnd())
    .filter(l => /[█▀▄]/.test(l));

  if (lines.length < 10) {
    return null;
  }

  const width = Math.max(...lines.map(l => l.length));
  const matrix: boolean[][] = [];

  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    const topRow: boolean[] = [];
    const botRow: boolean[] = [];

    for (let c = 0; c < width; c++) {
      const ch = line[c] || " ";
      if (ch === "█") {
        topRow.push(true);
        botRow.push(true);
      } else if (ch === "▀") {
        topRow.push(true);
        botRow.push(false);
      } else if (ch === "▄") {
        topRow.push(false);
        botRow.push(true);
      } else {
        topRow.push(false);
        botRow.push(false);
      }
    }
    matrix.push(topRow);
    matrix.push(botRow);
  }

  const height = matrix.length;
  let rects = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (matrix[y][x]) {
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" style="background:#fff;border-radius:8px;padding:8px">${rects}</svg>`;
}

/**
 * 清理当前活跃的扫码登录会话。
 */
export function cancelTdlQrLogin(): void {
  if (sessionTimeoutTimer) {
    clearTimeout(sessionTimeoutTimer);
    sessionTimeoutTimer = null;
  }

  if (activeProcess) {
    try {
      activeProcess.kill("SIGTERM");
      setTimeout(() => {
        if (activeProcess && !activeProcess.killed) {
          activeProcess.kill("SIGKILL");
        }
        activeProcess = null;
      }, 1000).unref();
    } catch {
      activeProcess = null;
    }
  }

  currentSession = {
    status: "canceled",
  };
}

/**
 * 启动 TDL 扫码登录流程。
 */
export async function startTdlQrLogin(): Promise<TdlQrSessionState> {
  cancelTdlQrLogin();

  const bin = await resolveTdlBinaryPath();
  const setting = getSetting();
  const namespace = setting?.tdlNamespace || "default";

  const args = ["login", "-T", "qr", "-n", namespace];
  if (setting?.proxy) {
    args.push("--proxy", setting.proxy);
  }
  if (setting?.tdlStorage) {
    args.push("--storage", setting.tdlStorage);
  }

  logger.info("启动 TDL 扫码登录", { bin, namespace });

  currentSession = {
    status: "starting",
  };

  const child = spawn(bin, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      PATH: `${path.join(os.homedir(), ".local", "bin")}:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
    },
  });

  activeProcess = child;

  // 扫码登录超时机制（5 分钟）
  sessionTimeoutTimer = setTimeout(
    () => {
      logger.warn("TDL 扫码登录会话超时");
      currentSession = {
        status: "failed",
        error: "扫码登录超时，请重新开始",
      };
      cancelTdlQrLogin();
    },
    5 * 60 * 1000
  );

  let stdoutBuffer = "";

  child.stdout.on("data", chunk => {
    const text = chunk.toString();
    stdoutBuffer += text;

    // 1. 尝试解析更新二维码
    const svg = textQrToSvg(stdoutBuffer);
    if (
      svg &&
      currentSession.status !== "waiting_password" &&
      currentSession.status !== "success"
    ) {
      currentSession = {
        status: "qr_ready",
        qrSvg: svg,
      };
    }

    // 2. 检查是否提示输入 2FA 密码
    if (
      text.includes("Enter 2FA Password:") ||
      stdoutBuffer.includes("Enter 2FA Password:")
    ) {
      logger.info("TDL 扫码登录需要二次验证密码 (2FA)");
      currentSession = {
        status: "waiting_password",
        qrSvg: currentSession.qrSvg,
      };
    }

    // 3. 检查是否登录成功
    const successMatch = stdoutBuffer.match(
      /Login successfully!\s*ID:\s*(\d+)(?:,\s*Username:\s*(\S+))?/i
    );
    if (successMatch) {
      const id = Number.parseInt(successMatch[1], 10);
      const username = successMatch[2] || undefined;
      logger.info("TDL 扫码登录成功！", { id, username });

      currentSession = {
        status: "success",
        user: { id, username },
      };

      if (sessionTimeoutTimer) {
        clearTimeout(sessionTimeoutTimer);
        sessionTimeoutTimer = null;
      }
    }
  });

  child.stderr.on("data", chunk => {
    const text = chunk.toString();
    logger.debug("TDL 登录 stderr", text);
    if (text.includes("Enter 2FA Password:")) {
      currentSession = {
        status: "waiting_password",
        qrSvg: currentSession.qrSvg,
      };
    }
  });

  child.on("close", code => {
    activeProcess = null;
    if (sessionTimeoutTimer) {
      clearTimeout(sessionTimeoutTimer);
      sessionTimeoutTimer = null;
    }

    if (currentSession.status === "success") {
      return;
    }

    if (currentSession.status === "canceled") {
      return;
    }

    if (code !== 0) {
      logger.warn("TDL 登录进程退出", { code });
      currentSession = {
        status: "failed",
        error: currentSession.error || `登录未能完成 (进程退出码: ${code})`,
      };
    }
  });

  child.on("error", err => {
    activeProcess = null;
    logger.error("启动 TDL 登录进程失败", err);
    currentSession = {
      status: "failed",
      error: `启动 TDL 失败: ${err.message}`,
    };
  });

  // 等待最多 3 秒让二维码初次生成完成
  const startWait = Date.now();
  while (Date.now() - startWait < 3500) {
    if (
      currentSession.status === "qr_ready" ||
      currentSession.status === "failed"
    ) {
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return currentSession;
}

/**
 * 获取当前 TDL 扫码登录状态。
 */
export function getTdlQrLoginStatus(): TdlQrSessionState {
  return currentSession;
}

/**
 * 提交 2FA 二次验证密码。
 */
export async function submitTdl2faPassword(
  password: string
): Promise<TdlQrSessionState> {
  if (!activeProcess || !activeProcess.stdin) {
    throw new Error("无活跃的 TDL 登录进程，请重新开始扫码登录");
  }

  logger.info("向 TDL 进程提交 2FA 密码");
  activeProcess.stdin.write(`${password.trim()}\n`);

  // 等待 2 秒查看响应
  const waitStart = Date.now();
  while (Date.now() - waitStart < 2500) {
    if (
      currentSession.status === "success" ||
      currentSession.status === "failed"
    ) {
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return currentSession;
}

/**
 * 通过 Telegram Desktop 目录导入会话。
 */
export async function importTdlDesktopSession(options?: {
  desktopPath?: string;
  passcode?: string;
}): Promise<{ ok: boolean; message: string }> {
  const bin = await resolveTdlBinaryPath();
  const setting = getSetting();
  const namespace = setting?.tdlNamespace || "default";

  const args = ["login", "-T", "desktop", "-n", namespace];
  if (options?.desktopPath?.trim()) {
    args.push("-d", options.desktopPath.trim());
  }
  if (options?.passcode?.trim()) {
    args.push("-p", options.passcode.trim());
  }
  if (setting?.tdlStorage) {
    args.push("--storage", setting.tdlStorage);
  }

  return new Promise(resolve => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: `${path.join(os.homedir(), ".local", "bin")}:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
      },
    });

    let output = "";
    child.stdout.on("data", d => {
      output += d.toString();
    });
    child.stderr.on("data", d => {
      output += d.toString();
    });

    child.on("close", code => {
      if (
        code === 0 ||
        output.includes("Import") ||
        output.includes("successfully")
      ) {
        resolve({
          ok: true,
          message: "从 Telegram Desktop 导入会话成功！",
        });
      } else {
        resolve({
          ok: false,
          message: output.trim() || `导入失败 (退出码: ${code})`,
        });
      }
    });

    child.on("error", err => {
      resolve({
        ok: false,
        message: `无法执行导入: ${err.message}`,
      });
    });
  });
}
