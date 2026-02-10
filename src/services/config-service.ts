import fs from "node:fs";
import path from "node:path";
import { setLogLevel } from "@/services/logger.js";
import type { Setting } from "@/types/setting.js";

export type { Setting } from "@/types/setting.js";
export const DEFAULT_DOWNLOAD_FILE_CONCURRENCY = 3;
export const DEFAULT_LOG_LEVEL = "info";

const CONFIG_DIR = path.resolve(process.cwd(), "config");
const SETTING_PATH = path.join(CONFIG_DIR, "setting.json");

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function readSettingFromDisk(): Setting | null {
  if (!fs.existsSync(SETTING_PATH)) {
    return null;
  }
  const parsed = JSON.parse(
    fs.readFileSync(SETTING_PATH, "utf8")
  ) as Partial<Setting>;
  return {
    ...parsed,
    downloadFileConcurrency:
      typeof parsed.downloadFileConcurrency === "number"
        ? parsed.downloadFileConcurrency
        : DEFAULT_DOWNLOAD_FILE_CONCURRENCY,
    logLevel:
      parsed.logLevel === "debug" ||
      parsed.logLevel === "info" ||
      parsed.logLevel === "warn" ||
      parsed.logLevel === "error"
        ? parsed.logLevel
        : DEFAULT_LOG_LEVEL,
  } as Setting;
}

let settingCache = readSettingFromDisk();
const settingListeners = new Set<(setting: Setting | null) => void>();

function applyLoggerLevel(setting: Setting | null) {
  if (!setting) {
    return;
  }
  setLogLevel(setting.logLevel);
}

applyLoggerLevel(settingCache);

function emitSettingChange(setting: Setting | null) {
  for (const listener of settingListeners) {
    listener(setting);
  }
}

/**
 * 获取当前内存配置。
 * @returns 当前配置
 */
export function getSetting(): Setting | null {
  return settingCache;
}

/**
 * 重新从磁盘加载配置到内存。
 * @returns 重新加载后的配置
 */
export function reloadSetting(): Setting | null {
  settingCache = readSettingFromDisk();
  applyLoggerLevel(settingCache);
  return settingCache;
}

/**
 * 当前是否已完成配置初始化。
 * @returns 是否已初始化
 */
export function isConfigured(): boolean {
  return settingCache !== null;
}

/**
 * 获取必需配置，未初始化时抛错。
 * @returns 当前配置
 */
export function requireSetting(): Setting {
  if (!settingCache) {
    throw new Error("配置尚未初始化，请先在前端完成配置初始化。");
  }
  return settingCache;
}

/**
 * 将配置写入磁盘并刷新内存缓存。
 * @param setting 新配置
 * @returns 已保存的配置
 */
export function saveSetting(setting: Setting): Setting {
  settingCache = setting;
  fs.writeFileSync(SETTING_PATH, JSON.stringify(settingCache, null, 2));
  applyLoggerLevel(settingCache);
  emitSettingChange(settingCache);
  return settingCache;
}

/**
 * 订阅配置变更。
 * @param listener 配置变更回调
 * @returns 取消订阅函数
 */
export function subscribeSettingChanges(
  listener: (setting: Setting | null) => void
) {
  settingListeners.add(listener);
  return () => {
    settingListeners.delete(listener);
  };
}
