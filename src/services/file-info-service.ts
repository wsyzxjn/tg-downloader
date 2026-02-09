import type { Message } from "grammy/types";
import type { MediaType } from "@/types/setting.js";

/**
 * 从消息中提取文件信息
 */
export interface FileInfo {
  fileId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  mediaType: MediaType;
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
 * 从消息中获取文件 ID 和相关信息
 * @param message Telegram 消息对象
 * @returns 文件信息，如果消息不包含文件则返回 null
 */
export function getFileInfo(message: Message): FileInfo | null {
  if (message.photo) {
    const photo = message.photo[message.photo.length - 1];
    return {
      fileId: photo.file_id,
      fileSize: photo.file_size,
      fileName: buildFallbackFileName(message.message_id),
      mediaType: "photo",
    };
  }

  if (message.video) {
    return {
      fileId: message.video.file_id,
      fileName:
        message.video.file_name || buildFallbackFileName(message.message_id),
      fileSize: message.video.file_size,
      mimeType: message.video.mime_type,
      mediaType: "video",
    };
  }

  if (message.document) {
    return {
      fileId: message.document.file_id,
      fileName:
        message.document.file_name || buildFallbackFileName(message.message_id),
      fileSize: message.document.file_size,
      mimeType: message.document.mime_type,
      mediaType: "document",
    };
  }

  if (message.audio) {
    return {
      fileId: message.audio.file_id,
      fileName:
        message.audio.file_name || buildFallbackFileName(message.message_id),
      fileSize: message.audio.file_size,
      mimeType: message.audio.mime_type,
      mediaType: "audio",
    };
  }

  if (message.voice) {
    return {
      fileId: message.voice.file_id,
      fileName: buildFallbackFileName(message.message_id),
      fileSize: message.voice.file_size,
      mimeType: message.voice.mime_type,
      mediaType: "voice",
    };
  }

  if (message.video_note) {
    return {
      fileId: message.video_note.file_id,
      fileName: buildFallbackFileName(message.message_id),
      fileSize: message.video_note.file_size,
      mediaType: "video_note",
    };
  }

  if (message.animation) {
    return {
      fileId: message.animation.file_id,
      fileName:
        message.animation.file_name ||
        buildFallbackFileName(message.message_id),
      fileSize: message.animation.file_size,
      mimeType: message.animation.mime_type,
      mediaType: "animation",
    };
  }

  if (message.sticker) {
    return {
      fileId: message.sticker.file_id,
      fileName: buildFallbackFileName(message.message_id),
      fileSize: message.sticker.file_size,
      mediaType: "sticker",
    };
  }

  return null;
}
