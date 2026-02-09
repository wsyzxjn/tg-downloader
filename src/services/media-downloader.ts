import fs from "node:fs/promises";
import path from "node:path";
import type { Message } from "grammy/types";
import sanitizeFilename from "sanitize-filename";
import { Api } from "telegram";
import { getClient } from "@/client.js";
import type { FileInfo } from "@/services/file-info-service.js";
import {
  resolveSourceMessageFromBotMessage,
  resolveSourceMessageFromLink,
} from "@/services/source-resolver.js";

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
  speedBytesPerSec?: number;
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  albumConcurrency?: number;
}

export interface LinkDownloadOptions extends DownloadOptions {
  allowedMediaTypes?: FileInfo["mediaType"][];
}

export interface BatchDownloadResult {
  filePaths: string[];
  fileInfos: FileInfo[];
}

const DEFAULT_ALBUM_DOWNLOAD_CONCURRENCY = 3;
const MAX_ALBUM_DOWNLOAD_CONCURRENCY = 8;
const DEFAULT_DOWNLOAD_PART_SIZE_KB = 512;
const MIN_DOWNLOAD_PART_SIZE_KB = 4;
const MAX_DOWNLOAD_PART_SIZE_KB = 512;

function resolveAlbumDownloadConcurrency(
  requested: number | undefined
): number {
  if (typeof requested !== "number" || !Number.isInteger(requested)) {
    return DEFAULT_ALBUM_DOWNLOAD_CONCURRENCY;
  }
  return Math.max(1, Math.min(MAX_ALBUM_DOWNLOAD_CONCURRENCY, requested));
}

function resolveDownloadPartSizeKb(): number {
  const raw = Number.parseInt(process.env.DOWNLOAD_PART_SIZE_KB || "", 10);
  const normalized = Number.isNaN(raw) ? DEFAULT_DOWNLOAD_PART_SIZE_KB : raw;
  const clamped = Math.max(
    MIN_DOWNLOAD_PART_SIZE_KB,
    Math.min(MAX_DOWNLOAD_PART_SIZE_KB, normalized)
  );
  return clamped - (clamped % 4);
}

function extractDocumentFromMessage(
  sourceMessage: Api.Message
): Api.Document | null {
  return (
    sourceMessage.video ||
    sourceMessage.audio ||
    sourceMessage.voice ||
    sourceMessage.gif ||
    sourceMessage.sticker ||
    sourceMessage.document ||
    sourceMessage.videoNote ||
    null
  );
}

function photoSizeScore(size: Api.TypePhotoSize): number {
  if (size instanceof Api.PhotoStrippedSize) {
    return size.bytes.length;
  }
  if (size instanceof Api.PhotoCachedSize) {
    return size.bytes.length;
  }
  if (size instanceof Api.PhotoSize) {
    return size.size;
  }
  if (size instanceof Api.PhotoSizeProgressive) {
    return Math.max(...size.sizes);
  }
  return 0;
}

function pickLargestPhotoSize(photo: Api.Photo): Api.TypePhotoSize | null {
  const sizes = [...(photo.sizes || [])].filter(
    size =>
      !(size instanceof Api.PhotoPathSize || size instanceof Api.PhotoSizeEmpty)
  );
  if (sizes.length === 0) {
    return null;
  }

  sizes.sort((a, b) => photoSizeScore(a) - photoSizeScore(b));
  return sizes[sizes.length - 1] ?? null;
}

/**
 * 生成紧凑时间戳字符串。
 * @param date 时间对象
 * @returns 形如 20260207_182530_123 的时间戳
 */
function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  const millisecond = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}${month}${day}_${hour}${minute}${second}_${millisecond}`;
}

/**
 * 在文件名末尾追加时间戳，保留原扩展名。
 * @param fileName 原始文件名
 * @returns 带时间戳的文件名
 */
function addTimestampToFileName(fileName: string): string {
  const parsed = path.parse(fileName);
  const timestamp = formatTimestamp(new Date());
  const baseName = parsed.name || "file";
  return `${baseName}_${timestamp}${parsed.ext}`;
}

/**
 * 生成统一的兜底文件名（不包含媒体类型）。
 * @param messageId 消息 ID
 * @returns 兜底文件名
 */
function buildFallbackFileName(messageId: number): string {
  return `message_${messageId}`;
}

/**
 * 下载一条已定位的源消息。
 * @param sourceMessage GramJS 源消息对象
 * @param fileInfo 文件元信息
 * @param downloadDir 下载目录
 * @param options 下载可选项（进度回调）
 * @returns 落盘后的文件路径
 */
async function downloadSourceMessage(
  sourceMessage: Api.Message,
  fileInfo: FileInfo,
  downloadDir: string,
  options?: DownloadOptions
) {
  let lastDownloaded = 0;
  let lastAt = Date.now();
  const client = getClient();
  await fs.mkdir(downloadDir, { recursive: true });
  const baseName = fileInfo.fileName || "file";
  const candidateName = addTimestampToFileName(baseName);
  const safeName =
    sanitizeFilename(candidateName) || `file_${formatTimestamp(new Date())}`;
  const targetPath = path.resolve(downloadDir, safeName);
  const partSizeKb = resolveDownloadPartSizeKb();
  try {
    const progressCallback = (
      downloaded: { toString(): string },
      total: { toString(): string }
    ) => {
      const downloadedNum = Number.parseInt(downloaded.toString(), 10);
      const totalNum = Number.parseInt(total.toString(), 10);
      const percent =
        totalNum > 0
          ? Math.min(100, Math.floor((downloadedNum * 100) / totalNum))
          : 0;
      const now = Date.now();
      const deltaBytes = downloadedNum - lastDownloaded;
      const deltaMs = now - lastAt;
      const speedBytesPerSec =
        deltaBytes > 0 && deltaMs > 0
          ? Math.floor((deltaBytes * 1000) / deltaMs)
          : 0;
      lastDownloaded = downloadedNum;
      lastAt = now;

      options?.onProgress?.({
        downloaded: Number.isNaN(downloadedNum) ? 0 : downloadedNum,
        total: Number.isNaN(totalNum) ? 0 : totalNum,
        percent,
        speedBytesPerSec,
      });
    };

    const document = extractDocumentFromMessage(sourceMessage);
    let result: string | Buffer | undefined;
    if (document) {
      result = await client.downloadFile(
        new Api.InputDocumentFileLocation({
          id: document.id,
          accessHash: document.accessHash,
          fileReference: document.fileReference,
          thumbSize: "",
        }),
        {
          outputFile: targetPath,
          partSizeKb,
          fileSize: document.size,
          dcId: document.dcId,
          progressCallback,
        }
      );
    } else if (sourceMessage.photo instanceof Api.Photo) {
      const largestSize = pickLargestPhotoSize(sourceMessage.photo);
      if (!largestSize) {
        throw new Error("无法获取可下载的图片尺寸");
      }
      const photoSize =
        largestSize instanceof Api.PhotoSizeProgressive
          ? Math.max(...largestSize.sizes)
          : "size" in largestSize
            ? largestSize.size
            : 512;
      result = await client.downloadFile(
        new Api.InputPhotoFileLocation({
          id: sourceMessage.photo.id,
          accessHash: sourceMessage.photo.accessHash,
          fileReference: sourceMessage.photo.fileReference,
          thumbSize: "type" in largestSize ? largestSize.type : "",
        }),
        {
          outputFile: targetPath,
          partSizeKb,
          fileSize: photoSize as never,
          dcId: sourceMessage.photo.dcId,
          progressCallback,
        }
      );
    } else {
      result = await client.downloadMedia(sourceMessage, {
        outputFile: targetPath,
        progressCallback,
      });
    }

    if (typeof result === "string") {
      return result;
    }

    return targetPath;
  } catch (error) {
    try {
      await fs.rm(targetPath, { force: true });
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
}

/**
 * 在相册场景下解析同组消息，非相册则返回当前消息。
 * @param sourceMessage 已定位的源消息
 * @returns 需要下载的源消息列表
 */
async function resolveBatchSourceMessages(
  sourceMessage: Api.Message
): Promise<Api.Message[]> {
  const groupedId = sourceMessage.groupedId?.toString();
  if (!groupedId) {
    return [sourceMessage];
  }

  const client = getClient();
  const peerCandidate = (
    sourceMessage as Api.Message & {
      peerId?: unknown;
    }
  ).peerId;
  const chatRef = peerCandidate ?? sourceMessage.toId;

  try {
    const peer = await client.getInputEntity(chatRef as never);
    const nearbyMessages = await client.getMessages(peer, {
      limit: 100,
      minId: Math.max(0, sourceMessage.id - 50),
      maxId: sourceMessage.id + 50,
    });

    const groupedMessages = nearbyMessages.filter(
      message =>
        message instanceof Api.Message &&
        message.groupedId?.toString() === groupedId
    ) as Api.Message[];

    if (!groupedMessages.some(message => message.id === sourceMessage.id)) {
      groupedMessages.push(sourceMessage);
    }

    groupedMessages.sort((a, b) => a.id - b.id);
    return groupedMessages;
  } catch {
    return [sourceMessage];
  }
}

/**
 * 从文档属性中提取原始文件名。
 * @param document Telegram 文档对象
 * @param fallbackName 兜底文件名
 * @returns 提取到的文件名或兜底值
 */
function getFileNameFromDocument(
  document: Api.Document,
  fallbackName: string
): string {
  for (const attribute of document.attributes) {
    if (attribute instanceof Api.DocumentAttributeFilename) {
      return attribute.fileName;
    }
  }
  return fallbackName;
}

/**
 * 将 Telegram 的大整数文件大小转换为 number。
 * @param size Telegram 文件大小对象
 * @returns 转换后的字节大小
 */
function normalizeFileSize(
  size: { toString(): string } | undefined
): number | undefined {
  if (!size) {
    return undefined;
  }
  const parsed = Number.parseInt(size.toString(), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * 从 GramJS 源消息中提取可下载文件信息。
 * @param sourceMessage 源消息
 * @returns 文件信息；不包含可下载媒体时返回 null
 */
function getFileInfoFromSourceMessage(
  sourceMessage: Api.Message
): FileInfo | null {
  if (sourceMessage.photo) {
    return {
      fileId: "",
      fileName: buildFallbackFileName(sourceMessage.id),
      mediaType: "photo",
    };
  }

  if (sourceMessage.videoNote) {
    return {
      fileId: "",
      fileName: buildFallbackFileName(sourceMessage.id),
      mediaType: "video_note",
    };
  }

  if (sourceMessage.video) {
    return {
      fileId: "",
      fileName: getFileNameFromDocument(
        sourceMessage.video,
        buildFallbackFileName(sourceMessage.id)
      ),
      fileSize: normalizeFileSize(sourceMessage.video.size),
      mimeType: sourceMessage.video.mimeType,
      mediaType: "video",
    };
  }

  if (sourceMessage.audio) {
    return {
      fileId: "",
      fileName: getFileNameFromDocument(
        sourceMessage.audio,
        buildFallbackFileName(sourceMessage.id)
      ),
      fileSize: normalizeFileSize(sourceMessage.audio.size),
      mimeType: sourceMessage.audio.mimeType,
      mediaType: "audio",
    };
  }

  if (sourceMessage.voice) {
    return {
      fileId: "",
      fileName: buildFallbackFileName(sourceMessage.id),
      fileSize: normalizeFileSize(sourceMessage.voice.size),
      mimeType: sourceMessage.voice.mimeType,
      mediaType: "voice",
    };
  }

  if (sourceMessage.gif) {
    return {
      fileId: "",
      fileName: getFileNameFromDocument(
        sourceMessage.gif,
        buildFallbackFileName(sourceMessage.id)
      ),
      fileSize: normalizeFileSize(sourceMessage.gif.size),
      mimeType: sourceMessage.gif.mimeType,
      mediaType: "animation",
    };
  }

  if (sourceMessage.sticker) {
    return {
      fileId: "",
      fileName: buildFallbackFileName(sourceMessage.id),
      fileSize: normalizeFileSize(sourceMessage.sticker.size),
      mimeType: sourceMessage.sticker.mimeType,
      mediaType: "sticker",
    };
  }

  if (sourceMessage.document) {
    return {
      fileId: "",
      fileName: getFileNameFromDocument(
        sourceMessage.document,
        buildFallbackFileName(sourceMessage.id)
      ),
      fileSize: normalizeFileSize(sourceMessage.document.size),
      mimeType: sourceMessage.document.mimeType,
      mediaType: "document",
    };
  }

  return null;
}

/**
 * 批量下载一组源消息（包含相册场景），并输出聚合进度。
 * @param sourceMessages 源消息列表
 * @param downloadDir 下载目录
 * @param options 下载可选项（进度回调、允许的媒体类型）
 * @returns 批量下载结果
 */
async function downloadSourceMessages(
  sourceMessages: Api.Message[],
  downloadDir: string,
  options?: LinkDownloadOptions
): Promise<BatchDownloadResult> {
  const downloadableMessages = sourceMessages
    .map(sourceMessage => ({
      sourceMessage,
      fileInfo: getFileInfoFromSourceMessage(sourceMessage),
    }))
    .filter(
      (
        item
      ): item is {
        sourceMessage: Api.Message;
        fileInfo: FileInfo;
      } => item.fileInfo !== null
    )
    .filter(item => {
      if (!options?.allowedMediaTypes) {
        return true;
      }
      return options.allowedMediaTypes.includes(item.fileInfo.mediaType);
    });

  if (downloadableMessages.length === 0) {
    throw new Error("消息不包含可下载文件，或文件类型不在允许列表中。");
  }

  const filePaths = new Array<string>(downloadableMessages.length);
  const fileInfos = new Array<FileInfo>(downloadableMessages.length);
  const totalFiles = downloadableMessages.length;
  const totalBytes = downloadableMessages.reduce(
    (sum, item) => sum + (item.fileInfo.fileSize || 0),
    0
  );
  const progressByIndex = downloadableMessages.map(() => ({
    downloaded: 0,
    total: 0,
    percent: 0,
    speedBytesPerSec: 0,
  }));
  const emitAggregateProgress = () => {
    const aggregateDownloaded = progressByIndex.reduce(
      (sum, progress) => sum + progress.downloaded,
      0
    );
    const aggregateTotal =
      totalBytes > 0
        ? totalBytes
        : progressByIndex.reduce(
            (sum, progress) =>
              sum + Math.max(progress.total, progress.downloaded),
            0
          );
    const percent =
      aggregateTotal > 0
        ? Math.floor((aggregateDownloaded / aggregateTotal) * 100)
        : Math.floor(
            progressByIndex.reduce(
              (sum, progress) => sum + progress.percent,
              0
            ) / totalFiles
          );
    const aggregateSpeed = progressByIndex.reduce(
      (sum, progress) => sum + (progress.speedBytesPerSec || 0),
      0
    );

    options?.onProgress?.({
      downloaded: aggregateDownloaded,
      total: aggregateTotal,
      percent: Math.max(0, Math.min(100, percent)),
      speedBytesPerSec: aggregateSpeed,
    });
  };

  const concurrency = Math.min(
    totalFiles,
    resolveAlbumDownloadConcurrency(options?.albumConcurrency)
  );
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= totalFiles) {
        return;
      }

      const { sourceMessage, fileInfo } = downloadableMessages[index];
      const filePath = await downloadSourceMessage(
        sourceMessage,
        fileInfo,
        downloadDir,
        {
          onProgress: progress => {
            progressByIndex[index] = {
              downloaded: progress.downloaded,
              total: progress.total,
              percent: progress.percent,
              speedBytesPerSec: progress.speedBytesPerSec || 0,
            };
            emitAggregateProgress();
          },
        }
      );

      filePaths[index] = filePath;
      fileInfos[index] = fileInfo;
      progressByIndex[index] = {
        downloaded: fileInfo.fileSize || progressByIndex[index].downloaded,
        total:
          fileInfo.fileSize ||
          Math.max(
            progressByIndex[index].total,
            progressByIndex[index].downloaded
          ),
        percent: 100,
        speedBytesPerSec: 0,
      };
      emitAggregateProgress();
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return {
    filePaths: filePaths.filter(filePath => Boolean(filePath)),
    fileInfos,
  };
}

/**
 * 根据 bot 收到的消息定位源消息并下载。
 * @param message bot 收到的消息
 * @param fileInfo 文件信息
 * @param downloadDir 下载目录
 * @param options 下载可选项（进度回调）
 * @returns 落盘后的文件路径
 */
export async function downloadFile(
  message: Message,
  fileInfo: FileInfo,
  downloadDir: string,
  options?: DownloadOptions
): Promise<BatchDownloadResult> {
  const sourceMessage = await resolveSourceMessageFromBotMessage(message);
  if (!sourceMessage) {
    throw new Error(
      "无法在用户端定位源消息。请确保是转发消息，且用户账号可访问来源聊天。"
    );
  }

  const sourceMessages = await resolveBatchSourceMessages(sourceMessage);
  const result = await downloadSourceMessages(sourceMessages, downloadDir, {
    onProgress: options?.onProgress,
  });

  if (result.fileInfos.length === 0) {
    result.fileInfos.push(fileInfo);
  }

  return result;
}

/**
 * 根据 t.me 消息链接下载文件。
 * @param messageLink Telegram 消息链接
 * @param downloadDir 下载目录
 * @param options 下载可选项（进度回调、允许的媒体类型）
 * @returns 下载后的文件路径与文件信息
 */
export async function downloadFileByMessageLink(
  messageLink: string,
  downloadDir: string,
  options?: LinkDownloadOptions
): Promise<BatchDownloadResult> {
  const sourceMessage = await resolveSourceMessageFromLink(messageLink);
  if (!sourceMessage) {
    throw new Error(
      "无法通过该链接定位源消息，请检查链接是否有效且账号可访问。"
    );
  }
  const sourceMessages = await resolveBatchSourceMessages(sourceMessage);
  return downloadSourceMessages(sourceMessages, downloadDir, options);
}
