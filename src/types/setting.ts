import type { MEDIA_TYPES } from "@/constants/media-types.js";

/**
 * 支持的媒体类型（从常量推导）
 */
export type MediaType = (typeof MEDIA_TYPES)[number];
export type LogLevel = "debug" | "info" | "warn" | "error";
export type StorageTarget = "local" | "openlist";

export interface Setting {
  // web auth
  webUsername?: string;
  webPasswordHash?: string;
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
  logLevel: LogLevel;
  allowedUserIds: number[];
  mediaTypes: MediaType[];
  // net
  proxy?: string;
  // tdl downloader integration
  tdlPath?: string;
  tdlNamespace?: string;
  tdlStorage?: string;
  tdlThreads?: number;
  // openlist integration
  storageTarget?: StorageTarget;
  openListEnabled?: boolean;
  openListBaseUrl?: string;
  openListUsername?: string;
  openListPassword?: string;
  openListTargetDir?: string;
  openListAsTask?: boolean;
}
