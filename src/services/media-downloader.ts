import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Message } from "grammy/types";
import sanitizeFilename from "sanitize-filename";
import type { Api } from "telegram";
import { getSetting } from "@/services/config-service.js";
import type { FileInfo } from "@/services/file-info-service.js";
import { createLogger } from "@/services/logger.js";
import { resolveSourceMessageFromBotMessage } from "@/services/source-resolver.js";
import { relayTelegramToOpenList } from "@/services/stream-relay-service.js";
import { downloadWithTdl } from "@/services/tdl-service.js";

const logger = createLogger("media-downloader");

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
  speedBytesPerSec?: number;
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  albumConcurrency?: number;
  storageTarget?: "local" | "openlist";
}

export interface LinkDownloadOptions extends DownloadOptions {
  allowedMediaTypes?: FileInfo["mediaType"][];
}

export interface BatchDownloadResult {
  filePaths: string[];
  fileInfos: FileInfo[];
  destination?: "local" | "openlist";
}

/**
 * 格式化紧凑时间戳。
 */
function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

/**
 * 在文件名末尾增加时间戳。
 */
function addTimestampToFileName(fileName: string): string {
  const parsed = path.parse(fileName);
  const timestamp = formatTimestamp(new Date());
  const baseName = parsed.name || "file";
  return `${baseName}_${timestamp}${parsed.ext}`;
}

/**
 * 当无法解析为 t.me 链接时，通过 Telegram Bot API 直接下载附件作为兜底。
 */
async function downloadDirectBotAttachment(
  fileInfo: FileInfo,
  downloadDir: string,
  options?: DownloadOptions
): Promise<BatchDownloadResult> {
  const setting = getSetting();
  const botToken = setting?.botToken;
  if (!botToken || !fileInfo.fileId) {
    throw new Error(
      "无法定位源消息链接。请确保该消息是来自公开频道/群组的转发，或在设置中配置了 Bot Token。"
    );
  }

  logger.info("使用 Bot API 兜底下载附件", {
    fileId: fileInfo.fileId,
    fileName: fileInfo.fileName,
  });

  await fs.mkdir(downloadDir, { recursive: true });

  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileInfo.fileId}`;
  const fileRes = await fetch(getFileUrl, { signal: options?.signal });
  if (!fileRes.ok) {
    throw new Error(`Bot API 获取文件失败: HTTP ${fileRes.status}`);
  }

  const fileData = (await fileRes.json()) as {
    ok: boolean;
    result?: { file_path: string; file_size?: number };
    description?: string;
  };

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error(fileData.description || "Bot API 未能返回有效的文件路径");
  }

  const remoteFilePath = fileData.result.file_path;
  const originalFileName =
    fileInfo.fileName || path.basename(remoteFilePath) || "file";
  const safeName =
    sanitizeFilename(addTimestampToFileName(originalFileName)) ||
    `file_${formatTimestamp(new Date())}`;
  const targetPath = path.resolve(downloadDir, safeName);

  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${remoteFilePath}`;
  const streamRes = await fetch(downloadUrl, { signal: options?.signal });
  if (!streamRes.ok || !streamRes.body) {
    throw new Error(`下载文件流失败: HTTP ${streamRes.status}`);
  }

  const total =
    fileData.result.file_size ||
    Number.parseInt(streamRes.headers.get("content-length") || "0", 10) ||
    fileInfo.fileSize ||
    0;

  let downloaded = 0;
  let lastDownloaded = 0;
  let lastAt = Date.now();

  const reader = streamRes.body.getReader();
  const fileStream = createWriteStream(targetPath);

  try {
    while (true) {
      if (options?.signal?.aborted) {
        throw new Error("任务已取消");
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      downloaded += value.length;
      fileStream.write(value);

      const now = Date.now();
      const deltaBytes = downloaded - lastDownloaded;
      const deltaMs = now - lastAt;
      const speedBytesPerSec =
        deltaBytes > 0 && deltaMs > 0
          ? Math.floor((deltaBytes * 1000) / deltaMs)
          : 0;

      lastDownloaded = downloaded;
      lastAt = now;

      const percent =
        total > 0 ? Math.min(100, Math.floor((downloaded * 100) / total)) : 50;

      options?.onProgress?.({
        downloaded,
        total,
        percent,
        speedBytesPerSec,
      });
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.end((err?: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    options?.onProgress?.({
      downloaded: total > 0 ? total : downloaded,
      total: total > 0 ? total : downloaded,
      percent: 100,
      speedBytesPerSec: 0,
    });

    return {
      destination: "local",
      filePaths: [targetPath],
      fileInfos: [
        {
          ...fileInfo,
          fileName: safeName,
          fileSize: downloaded,
        },
      ],
    };
  } catch (err) {
    fileStream.close();
    try {
      await fs.unlink(targetPath);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}

/**
 * 根据 Telegram 消息链接下载媒体文件。
 * 若目标为 OpenList，则通过流式不落盘管道直接转存。
 */
export async function downloadFileByMessageLink(
  messageLink: string,
  downloadDir: string,
  options?: LinkDownloadOptions
): Promise<BatchDownloadResult> {
  const setting = getSetting();

  const useOpenList =
    options?.storageTarget === "openlist" ||
    (setting?.openListEnabled && setting?.storageTarget === "openlist");

  if (useOpenList) {
    logger.info("采用不落盘流式管道转存至 OpenList", { messageLink });
    const relayResult = await relayTelegramToOpenList({
      urls: [messageLink],
      targetDir: setting?.openListTargetDir,
      signal: options?.signal,
      onProgress: options?.onProgress,
    });

    return {
      destination: "openlist",
      filePaths: relayResult.filePaths,
      fileInfos: relayResult.fileInfos,
    };
  }

  logger.info("使用 tdl 下载 Telegram 消息链接至本地磁盘", {
    messageLink,
    downloadDir,
  });

  const result = await downloadWithTdl({
    urls: [messageLink],
    downloadDir,
    group: true,
    threads: setting?.tdlThreads,
    concurrency: options?.albumConcurrency ?? setting?.downloadFileConcurrency,
    proxy: setting?.proxy,
    namespace: setting?.tdlNamespace,
    storage: setting?.tdlStorage,
    signal: options?.signal,
    onProgress: options?.onProgress,
  });

  if (result.filePaths.length === 0) {
    throw new Error("未检测到下载落盘的文件，请检查链接内容是否包含可下载媒体");
  }

  return {
    destination: "local",
    filePaths: result.filePaths,
    fileInfos: result.fileInfos,
  };
}

/**
 * 根据 Bot 收到的消息解析链接并执行转存或下载。
 */
export async function downloadFile(
  message: Message,
  fileInfo: FileInfo,
  downloadDir: string,
  options?: DownloadOptions
): Promise<BatchDownloadResult> {
  // 1. 尝试从 forward_origin 解析来源频道/群组链接
  const origin = message.forward_origin;
  if (origin && origin.type === "channel") {
    const chat = origin.chat;
    const channelLink =
      "username" in chat && chat.username
        ? `https://t.me/${chat.username}/${origin.message_id}`
        : `https://t.me/c/${String(chat.id).replace(/^-100/, "")}/${origin.message_id}`;
    logger.info("从频道转发中解析到消息链接", { channelLink });
    return downloadFileByMessageLink(channelLink, downloadDir, options);
  }

  // 2. 尝试使用用户客户端通过 source-resolver 定位源消息
  try {
    const sourceMessage = await resolveSourceMessageFromBotMessage(message);
    if (sourceMessage) {
      const peerCandidate = (sourceMessage as Api.Message & { peerId?: any })
        .peerId;
      if (peerCandidate) {
        let peerIdStr = "";
        if ("channelId" in peerCandidate) {
          peerIdStr = peerCandidate.channelId.toString();
        } else if ("chatId" in peerCandidate) {
          peerIdStr = peerCandidate.chatId.toString();
        } else if ("userId" in peerCandidate) {
          peerIdStr = peerCandidate.userId.toString();
        }

        if (peerIdStr) {
          const cleanId = peerIdStr.replace(/^-100/, "").replace(/^-/, "");
          const link = `https://t.me/c/${cleanId}/${sourceMessage.id}`;
          logger.info("通过用户客户端成功解析消息链接", { link });
          return await downloadFileByMessageLink(link, downloadDir, options);
        }
      }
    }
  } catch (err) {
    logger.warn("通过用户客户端定位源消息失败，将尝试 Bot API 兜底下载", err);
  }

  // 3. 兜底策略：使用 Bot API 直接下载
  return downloadDirectBotAttachment(fileInfo, downloadDir, options);
}
