/**
 * 支持的媒体类型常量
 */
export const MEDIA_TYPES = [
  "photo", // 图片
  "animation", // GIF 动画
  "audio", // 音频
  "document", // 文档/文件
  "video", // 视频
  "video_note", // 视频消息（圆形）
  "voice", // 语音消息
  "sticker", // 贴纸
] as const;

/**
 * 默认允许下载的媒体类型
 */
export const DEFAULT_MEDIA_TYPES = [
  "photo",
  "video",
  "document",
  "audio",
] as const;
