import { getSetting } from "@/services/config-service.js";
import type { FileInfo } from "@/services/file-info-service.js";
import { createLogger } from "@/services/logger.js";
import type { DownloadProgress } from "@/services/media-downloader.js";
import { OpenListClient } from "@/services/openlist-service.js";
import { startTdlStreamServer } from "@/services/tdl-stream-server.js";

const logger = createLogger("stream-relay-service");

export interface StreamRelayOptions {
  urls: string[];
  targetDir?: string;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
}

export interface StreamRelayResult {
  filePaths: string[];
  fileNames: string[];
  fileInfos: FileInfo[];
}

/**
 * 从 Content-Disposition 请求头提取文件名。
 */
function extractFileNameFromDisposition(
  disposition: string | null,
  fallback: string
): string {
  if (!disposition) {
    return fallback;
  }
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].trim());
    } catch {
      return match[1].trim();
    }
  }
  return fallback;
}

/**
 * 将 Telegram 消息媒体不落盘直接通过流式传输转存到 OpenList。
 */
export async function relayTelegramToOpenList(
  options: StreamRelayOptions
): Promise<StreamRelayResult> {
  const setting = getSetting();
  if (
    !setting?.openListBaseUrl ||
    !setting?.openListUsername ||
    !setting?.openListPassword
  ) {
    throw new Error(
      "尚未配置 OpenList 服务地址或登录凭据，请在系统设置中配置并开启 OpenList 转存"
    );
  }

  const openlistClient = new OpenListClient({
    baseUrl: setting.openListBaseUrl,
    username: setting.openListUsername,
    password: setting.openListPassword,
    targetDir: options.targetDir || setting.openListTargetDir || "/Telegram",
    asTask: setting.openListAsTask,
  });

  const baseTargetDir = (
    options.targetDir ||
    setting.openListTargetDir ||
    "/Telegram"
  ).replace(/\/+$/, "");

  logger.info("启动免落盘转存任务至 OpenList", {
    urls: options.urls,
    targetDir: baseTargetDir,
  });

  // 1. 启动临时 TDL 流服务
  const session = await startTdlStreamServer(options.urls, {
    proxy: setting.proxy,
    namespace: setting.tdlNamespace,
    storage: setting.tdlStorage,
    signal: options.signal,
  });

  try {
    // 2. 从流服务首页解析待传输的媒体项列表
    const indexUrl = `http://127.0.0.1:${session.port}/`;
    const indexRes = await fetch(indexUrl, { signal: options.signal });
    if (!indexRes.ok) {
      throw new Error(`获取 TDL 媒体索引失败: HTTP ${indexRes.status}`);
    }

    const html = await indexRes.text();
    // 匹配如 href="/123456/789"
    const matches = Array.from(html.matchAll(/<a\s+href="([^"]+)"/g));
    const mediaPaths = matches.map(m => m[1]).filter(Boolean);

    if (mediaPaths.length === 0) {
      throw new Error("未在所给的链接中检测到可下载媒体项");
    }

    logger.info("检测到可转存媒体项", { count: mediaPaths.length, mediaPaths });

    // 3. 确保远程目录存在
    await openlistClient.ensureDirectory(baseTargetDir);

    const uploadedPaths: string[] = [];
    const uploadedNames: string[] = [];
    const fileInfos: FileInfo[] = [];

    // 4. 逐个将媒体项从本地流服务直接 Pipe 到 OpenList PUT 接口
    for (let i = 0; i < mediaPaths.length; i++) {
      if (options.signal?.aborted) {
        throw new Error("任务已取消");
      }

      const mediaPath = mediaPaths[i];
      const streamSourceUrl = `http://127.0.0.1:${session.port}${mediaPath.startsWith("/") ? mediaPath : `/${mediaPath}`}`;

      const mediaRes = await fetch(streamSourceUrl, {
        method: "GET",
        signal: options.signal,
      });

      if (!mediaRes.ok || !mediaRes.body) {
        throw new Error(
          `无法从 TDL 获取媒体流 [${mediaPath}]: HTTP ${mediaRes.status}`
        );
      }

      const contentLength = Number.parseInt(
        mediaRes.headers.get("content-length") || "0",
        10
      );
      const disposition = mediaRes.headers.get("content-disposition");
      const fallbackName = `tg_file_${Date.now()}_${i + 1}`;
      const fileName = extractFileNameFromDisposition(
        disposition,
        fallbackName
      );
      const remoteFilePath = `${baseTargetDir}/${fileName}`;

      logger.info(
        `开始直传第 ${i + 1}/${mediaPaths.length} 个文件至 OpenList`,
        {
          fileName,
          remoteFilePath,
          contentLength,
        }
      );

      // 构造带背压与吞吐率采样的流变换
      let transferred = 0;
      let lastTransferred = 0;
      let lastTime = Date.now();

      const progressStream = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          transferred += chunk.byteLength;
          const now = Date.now();
          const deltaMs = now - lastTime;

          if (deltaMs >= 500) {
            const deltaBytes = transferred - lastTransferred;
            const speedBytesPerSec = Math.floor((deltaBytes * 1000) / deltaMs);
            const percent =
              contentLength > 0
                ? Math.min(100, Math.floor((transferred * 100) / contentLength))
                : 50;

            options.onProgress?.({
              downloaded: transferred,
              total: contentLength,
              percent,
              speedBytesPerSec,
            });

            lastTransferred = transferred;
            lastTime = now;
          }

          controller.enqueue(chunk);
        },
      });

      const pipedBody = mediaRes.body.pipeThrough(progressStream);

      // 上传至 OpenList（不落盘）
      await openlistClient.uploadStream({
        targetFilePath: remoteFilePath,
        stream: pipedBody,
        contentLength,
        asTask: setting.openListAsTask ?? contentLength > 200 * 1024 * 1024,
        signal: options.signal,
      });

      options.onProgress?.({
        downloaded: contentLength > 0 ? contentLength : transferred,
        total: contentLength > 0 ? contentLength : transferred,
        percent: 100,
        speedBytesPerSec: 0,
      });

      uploadedPaths.push(remoteFilePath);
      uploadedNames.push(fileName);
      fileInfos.push({
        fileId: "",
        fileName,
        fileSize: contentLength || transferred,
        mediaType: "document",
      });
    }

    logger.info("全部媒体项已成功直传至 OpenList", {
      count: uploadedPaths.length,
      uploadedPaths,
    });

    return {
      filePaths: uploadedPaths,
      fileNames: uploadedNames,
      fileInfos,
    };
  } finally {
    // 5. 传输结束，安全终止 TDL 服务进程
    await session.close();
  }
}
