import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSetting } from "@/services/config-service.js";
import type { FileInfo } from "@/services/file-info-service.js";
import { createLogger } from "@/services/logger.js";
import type { DownloadProgress } from "@/services/media-downloader.js";

const logger = createLogger("tdl-service");

export interface TdlStatus {
  installed: boolean;
  path?: string;
  version?: string;
  authorized: boolean;
  namespace: string;
  error?: string;
}

export interface TdlDownloadOptions {
  urls: string[];
  downloadDir: string;
  group?: boolean;
  threads?: number;
  concurrency?: number;
  namespace?: string;
  storage?: string;
  proxy?: string;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
}

export interface TdlDownloadResult {
  filePaths: string[];
  fileInfos: FileInfo[];
}

const COMMON_TDL_PATHS = [
  path.join(os.homedir(), ".local", "bin", "tdl"),
  "/Volumes/AmatsukaM/project/tdl",
  "/usr/local/bin/tdl",
  "/opt/homebrew/bin/tdl",
];

let cachedBinaryPath: string | null = null;

async function fileExistsAndExecutable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 解析 tdl 可执行文件路径。
 * 优先级：配置指定 > 环境变量 > 常见用户路径 > PATH 系统查找。
 */
export async function resolveTdlBinaryPath(): Promise<string> {
  const setting = getSetting();
  if (setting?.tdlPath) {
    if (await fileExistsAndExecutable(setting.tdlPath)) {
      return setting.tdlPath;
    }
    logger.warn("配置指定的 tdlPath 不可执行或不存在", {
      path: setting.tdlPath,
    });
  }

  if (
    process.env.TDL_PATH &&
    (await fileExistsAndExecutable(process.env.TDL_PATH))
  ) {
    return process.env.TDL_PATH;
  }

  if (cachedBinaryPath && (await fileExistsAndExecutable(cachedBinaryPath))) {
    return cachedBinaryPath;
  }

  for (const candidate of COMMON_TDL_PATHS) {
    if (await fileExistsAndExecutable(candidate)) {
      cachedBinaryPath = candidate;
      return candidate;
    }
  }

  cachedBinaryPath = "tdl";
  return "tdl";
}

/**
 * 运行 tdl 命令并返回其输出结果。
 */
function runTdlCommand(
  bin: string,
  args: string[],
  timeoutMs = 10000
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise(resolve => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: `${path.join(os.homedir(), ".local", "bin")}:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
      },
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGTERM");
        resolve({
          stdout,
          stderr: `${stderr}\nTimeout after ${timeoutMs}ms`,
          code: -1,
        });
      }
    }, timeoutMs);

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("close", code => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, code: code ?? 0 });
      }
    });

    child.on("error", err => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr: `${stderr}\n${err.message}`, code: -1 });
      }
    });
  });
}

/**
 * 检查当前机器上 tdl 的安装与授权状态。
 */
export async function getTdlStatus(): Promise<TdlStatus> {
  const bin = await resolveTdlBinaryPath();
  const setting = getSetting();
  const namespace = setting?.tdlNamespace || "default";

  const versionResult = await runTdlCommand(bin, ["version"], 8000);
  if (versionResult.code !== 0 && !versionResult.stdout.includes("Version:")) {
    return {
      installed: false,
      authorized: false,
      namespace,
      error: versionResult.stderr.trim() || "tdl 命令未找到或无法执行",
    };
  }

  const versionMatch = versionResult.stdout.match(/Version:\s*([^\s]+)/i);
  const version = versionMatch ? versionMatch[1] : "unknown";

  const checkArgs = ["chat", "ls", "-n", namespace];
  if (setting?.proxy) {
    checkArgs.push("--proxy", setting.proxy);
  }
  if (setting?.tdlStorage) {
    checkArgs.push("--storage", setting.tdlStorage);
  }

  const authResult = await runTdlCommand(bin, checkArgs, 10000);
  const allOutput = `${authResult.stdout} ${authResult.stderr}`;

  const isNotAuthorized =
    allOutput.includes("not authorized") ||
    allOutput.includes("please login first") ||
    allOutput.includes("SESSION_PASSWORD_NEEDED");

  return {
    installed: true,
    path: bin,
    version,
    authorized: authResult.code === 0 && !isNotAuthorized,
    namespace,
    error: isNotAuthorized
      ? "未登录 Telegram，请先在终端运行 `tdl login` 完成登录"
      : authResult.code !== 0
        ? authResult.stderr.trim()
        : undefined,
  };
}

/**
 * 去除终端控制符与颜色编码。
 */
function cleanAnsi(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes parsing
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

/**
 * 解析人类可读的大小字符串（如 "12.5MB"）为字节数。
 */
function parseHumanSize(str: string): number | null {
  const match = str.trim().match(/^([\d.]+)\s*([A-Za-z]+)?$/);
  if (!match) {
    return null;
  }
  const val = Number.parseFloat(match[1]);
  if (Number.isNaN(val)) {
    return null;
  }
  const unit = (match[2] || "B").toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    K: 1024,
    MB: 1024 * 1024,
    MIB: 1024 * 1024,
    M: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    GIB: 1024 * 1024 * 1024,
    G: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
    TIB: 1024 * 1024 * 1024 * 1024,
    T: 1024 * 1024 * 1024 * 1024,
  };
  const multiplier = multipliers[unit] ?? 1;
  return Math.round(val * multiplier);
}

/**
 * 解析人类可读的速度字符串（如 "2.1MB/s"）为字节每秒。
 */
function parseSpeed(str: string): number | undefined {
  const clean = str.replace(/\/s$/i, "").trim();
  const bytes = parseHumanSize(clean);
  return bytes ?? undefined;
}

/**
 * 格式化文件媒体类型。
 */
function inferMediaTypeFromExt(ext: string): FileInfo["mediaType"] {
  const cleanExt = ext.toLowerCase().replace(/^\./, "");
  const photoExts = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "heic",
    "heif",
    "svg",
  ];
  const videoExts = [
    "mp4",
    "mkv",
    "avi",
    "mov",
    "webm",
    "flv",
    "m4v",
    "wmv",
    "3gp",
  ];
  const audioExts = ["mp3", "flac", "ogg", "m4a", "wav", "aac", "opus", "wma"];

  if (photoExts.includes(cleanExt)) {
    return "photo";
  }
  if (videoExts.includes(cleanExt)) {
    return "video";
  }
  if (audioExts.includes(cleanExt)) {
    return "audio";
  }
  return "document";
}

/**
 * 从 tdl 输出行解析进度信息。
 */
export function parseTdlProgressLine(
  rawLine: string
): Partial<DownloadProgress> | null {
  const line = cleanAnsi(rawLine);
  if (!line.includes("%") && !line.includes("->")) {
    return null;
  }

  const percentMatch = line.match(/\b(\d+(?:\.\d+)?)\s*%/);
  const bytesMatch = line.match(
    /\((\d+(?:\.\d+)?\s*[A-Za-z]+)\s*\/\s*(\d+(?:\.\d+)?\s*[A-Za-z]+)/
  );
  const speedMatch = line.match(/([\d.]+\s*[A-Za-z]+\/s)/);

  if (!percentMatch && !bytesMatch && !speedMatch) {
    return null;
  }

  const percent = percentMatch
    ? Math.min(100, Math.floor(Number.parseFloat(percentMatch[1])))
    : 0;
  const downloaded = bytesMatch ? (parseHumanSize(bytesMatch[1]) ?? 0) : 0;
  const total = bytesMatch ? (parseHumanSize(bytesMatch[2]) ?? 0) : 0;
  const speedBytesPerSec = speedMatch ? parseSpeed(speedMatch[1]) : undefined;

  return {
    percent,
    downloaded,
    total,
    speedBytesPerSec,
  };
}

/**
 * 规范化 tdl 错误信息。
 */
function normalizeTdlError(stderr: string, stdout: string): string {
  const combined = `${stderr}\n${stdout}`;
  if (
    combined.includes("not authorized") ||
    combined.includes("please login first")
  ) {
    return "Telegram 客户端未授权。请在终端执行 `tdl login`（支持 Telegram Desktop 导入或扫码）完成后重试。";
  }
  if (combined.includes("message may be deleted")) {
    return "消息可能已被删除或不存在。";
  }
  if (combined.includes("FLOOD_WAIT")) {
    return "Telegram API 请求过于频繁，触发限流，请稍后再试。";
  }
  if (
    combined.includes("dial tcp") ||
    combined.includes("connect: connection refused")
  ) {
    return "网络连接失败，请检查网络配置或代理设置。";
  }
  if (combined.includes("no urls or files provided")) {
    return "未提供有效的下载链接。";
  }

  const firstErrorLine = stderr
    .split("\n")
    .map(line => cleanAnsi(line).trim())
    .find(line => line.length > 0 && !line.startsWith("202"));

  return firstErrorLine || stderr.trim() || "TDL 下载失败";
}

/**
 * 递归获取目录下非 .tmp 文件的状态映射。
 */
async function snapshotDirectory(dir: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.endsWith(".tmp")) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          map.set(fullPath, stat.mtimeMs);
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // directory may not exist yet
  }
  return map;
}

/**
 * 清理目录下的残留 .tmp 文件。
 */
async function cleanupTempFiles(dir: string): Promise<void> {
  try {
    const entries = await fs.readdir(dir);
    for (const file of entries) {
      if (file.endsWith(".tmp")) {
        try {
          await fs.unlink(path.join(dir, file));
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
}

/**
 * 使用 tdl 下载一组 Telegram 消息。
 */
export async function downloadWithTdl(
  options: TdlDownloadOptions
): Promise<TdlDownloadResult> {
  const bin = await resolveTdlBinaryPath();
  const setting = getSetting();
  const targetDir = path.resolve(options.downloadDir);
  await fs.mkdir(targetDir, { recursive: true });

  const initialFiles = await snapshotDirectory(targetDir);

  const args: string[] = ["dl"];
  for (const url of options.urls) {
    args.push("-u", url);
  }

  args.push("-d", targetDir);

  if (options.group !== false) {
    args.push("--group");
  }

  args.push("--continue");
  args.push("--skip-same");
  args.push("--rewrite-ext");

  const threads = options.threads ?? setting?.tdlThreads ?? 4;
  args.push("-t", String(threads));

  const concurrency =
    options.concurrency ?? setting?.downloadFileConcurrency ?? 2;
  args.push("-l", String(concurrency));

  const namespace = options.namespace ?? setting?.tdlNamespace ?? "default";
  args.push("-n", namespace);

  const proxy = options.proxy ?? setting?.proxy;
  if (proxy) {
    args.push("--proxy", proxy);
  }

  const storage = options.storage ?? setting?.tdlStorage;
  if (storage) {
    args.push("--storage", storage);
  }

  logger.info("启动 tdl 下载任务", {
    bin,
    urls: options.urls,
    targetDir,
    threads,
    concurrency,
    namespace,
  });

  return new Promise<TdlDownloadResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let highestPercent = 0;
    const explicitPaths: string[] = [];

    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: `${path.join(os.homedir(), ".local", "bin")}:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`,
      },
    });

    const onAbort = () => {
      logger.info("收到取消信号，正在终止 tdl 进程", { pid: child.pid });
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 2000).unref();
      void cleanupTempFiles(targetDir);
      reject(new Error("任务已取消"));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    const processOutputChunk = (chunkStr: string) => {
      const lines = chunkStr.split(/[\r\n]+/);
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const targetMatch = line.match(/->\s+(.+?)(?:\.tmp|\s+\[|\s*$)/);
        if (targetMatch) {
          const matchedTarget = targetMatch[1].trim();
          if (matchedTarget && !explicitPaths.includes(matchedTarget)) {
            explicitPaths.push(matchedTarget);
          }
        }

        const progress = parseTdlProgressLine(line);
        if (progress && progress.percent !== undefined) {
          if (progress.percent > highestPercent) {
            highestPercent = progress.percent;
          }
          options.onProgress?.({
            downloaded: progress.downloaded ?? 0,
            total: progress.total ?? 0,
            percent: highestPercent,
            speedBytesPerSec: progress.speedBytesPerSec,
          });
        }
      }
    };

    child.stdout.on("data", chunk => {
      const text = chunk.toString();
      stdout += text;
      processOutputChunk(text);
    });

    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      stderr += text;
      processOutputChunk(text);
    });

    child.on("close", async code => {
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }

      if (options.signal?.aborted) {
        return;
      }

      if (code !== 0) {
        logger.error("tdl 进程非正常退出", { code, stderr, stdout });
        await cleanupTempFiles(targetDir);
        reject(new Error(normalizeTdlError(stderr, stdout)));
        return;
      }

      options.onProgress?.({
        downloaded: 0,
        total: 0,
        percent: 100,
        speedBytesPerSec: 0,
      });

      const afterFiles = await snapshotDirectory(targetDir);
      const newOrUpdatedFiles: string[] = [];

      for (const [filePath, mtime] of afterFiles.entries()) {
        const prevMtime = initialFiles.get(filePath);
        if (prevMtime === undefined || mtime > prevMtime) {
          newOrUpdatedFiles.push(filePath);
        }
      }

      const finalPaths =
        newOrUpdatedFiles.length > 0
          ? newOrUpdatedFiles
          : explicitPaths.length > 0
            ? explicitPaths
            : [];

      const fileInfos: FileInfo[] = await Promise.all(
        finalPaths.map(async p => {
          const fileName = path.basename(p);
          try {
            const stat = await fs.stat(p);
            return {
              fileId: "",
              fileName,
              fileSize: stat.size,
              mediaType: inferMediaTypeFromExt(path.extname(fileName)),
            };
          } catch {
            return {
              fileId: "",
              fileName,
              mediaType: inferMediaTypeFromExt(path.extname(fileName)),
            };
          }
        })
      );

      logger.info("tdl 下载完成", { fileCount: finalPaths.length, finalPaths });
      resolve({
        filePaths: finalPaths,
        fileInfos,
      });
    });

    child.on("error", err => {
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
      logger.error("tdl 子进程启动失败", err);
      reject(new Error(`无法启动 tdl: ${err.message}`));
    });
  });
}
