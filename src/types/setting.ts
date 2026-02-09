import type { MEDIA_TYPES } from "@/constants/media-types.js";

/**
 * 支持的媒体类型（从常量推导）
 */
export type MediaType = (typeof MEDIA_TYPES)[number];

export interface Setting {
  // bot
  botToken?: string;
  // personal
  apiId: number;
  apiHash: string;
  // session
  session?: string;
  // download
  downloadDir: string;
  downloadFileConcurrency: number;
  allowedUserIds: number[];
  mediaTypes: MediaType[];
  // net
  proxy?: string;
}
