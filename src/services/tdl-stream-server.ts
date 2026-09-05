import { type ChildProcess, spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { getSetting } from "@/services/config-service.js";
import { createLogger } from "@/services/logger.js";
import { resolveTdlBinaryPath } from "@/services/tdl-service.js";

const logger = createLogger("tdl-stream-server");

export interface TdlStreamSession {
  port: number;
  process: ChildProcess;
  close: () => Promise<void>;
}

/**
 * 寻找一个可用的随机本地空闲端口。
 */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/**
 * 启动临时的 tdl HTTP 流式代理服务实例（用于不落盘直接中继）。
 */
export async function startTdlStreamServer(
  urls: string[],
  options?: {
    proxy?: string;
    namespace?: string;
    storage?: string;
    signal?: AbortSignal;
  }
): Promise<TdlStreamSession> {
  const bin = await resolveTdlBinaryPath();
  const setting = getSetting();
  const port = await findFreePort();

  const args: string[] = ["dl"];
  for (const url of urls) {
    args.push("-u", url);
  }

  args.push("--serve", "--port", String(port));

  const namespace = options?.namespace ?? setting?.tdlNamespace ?? "default";
  args.push("-n", namespace);

  const proxy = options?.proxy ?? setting?.proxy;
  if (proxy) {
    args.push("--proxy", proxy);
  }

  const storage = options?.storage ?? setting?.tdlStorage;
  if (storage) {
    args.push("--storage", storage);
  }

  logger.info("启动 tdl 免落盘流服务", {
    bin,
    port,
    urls,
    namespace,
  });

  const child = spawn(bin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PATH: `${path.join(os.homedir(), ".local", "bin")}:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
    },
  });

  let isClosed = false;

  const close = async () => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    logger.info("关闭 tdl 免落盘流服务", { pid: child.pid, port });
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 2000).unref();
  };

  if (options?.signal) {
    options.signal.addEventListener(
      "abort",
      () => {
        void close();
      },
      { once: true }
    );
  }

  // 等待流服务监听就绪
  await new Promise<void>((resolve, reject) => {
    let ready = false;
    let stdoutAcc = "";
    let stderrAcc = "";

    const timer = setTimeout(() => {
      if (!ready) {
        void close();
        reject(
          new Error(
            `启动 TDL 免落盘流服务超时 (15s): ${stderrAcc || stdoutAcc}`
          )
        );
      }
    }, 15000);

    const checkReady = (text: string) => {
      if (
        text.includes("Serving on http") ||
        text.includes("localhost:") ||
        text.includes(`127.0.0.1:${port}`)
      ) {
        ready = true;
        clearTimeout(timer);
        resolve();
      }
    };

    child.stdout.on("data", chunk => {
      const text = chunk.toString();
      stdoutAcc += text;
      checkReady(text);
    });

    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      stderrAcc += text;
      checkReady(text);

      if (
        text.includes("not authorized") ||
        text.includes("please login first")
      ) {
        clearTimeout(timer);
        void close();
        reject(
          new Error("Telegram 客户端未授权，请先运行 `tdl login` 完成登录")
        );
      }
    });

    child.on("error", err => {
      clearTimeout(timer);
      void close();
      reject(new Error(`无法启动 tdl 流服务: ${err.message}`));
    });

    child.on("close", code => {
      clearTimeout(timer);
      if (!ready) {
        reject(
          new Error(
            `tdl 流服务启动失败并退出 (退出码 ${code}): ${stderrAcc.trim() || stdoutAcc.trim()}`
          )
        );
      }
    });
  });

  return {
    port,
    process: child,
    close,
  };
}
