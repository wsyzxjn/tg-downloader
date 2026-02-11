import { TelegramClient } from "telegram";
import type { TelegramClientParams } from "telegram/client/telegramBaseClient.js";
import type { SocksProxyType } from "telegram/network/connection/TCPMTProxy.js";
import { StringSession } from "telegram/sessions/StringSession.js";
import { MEDIA_TYPES } from "@/constants/media-types.js";
import {
  DEFAULT_DOWNLOAD_FILE_CONCURRENCY,
  DEFAULT_LOG_LEVEL,
  getSetting,
  isConfigured,
  reloadSetting,
  type Setting,
  saveSetting,
} from "@/services/config-service.js";
import { createLogger } from "@/services/logger.js";
import {
  createWebAuthCredential,
  revokeAllWebAuthSessions,
} from "@/services/web-auth-service.js";

const logger = createLogger("setting-management");
let selfUserIdCache: number | null = null;
let resolvingSelfUserId: Promise<number> | null = null;
let currentClientKey = "";

type SettingBaseInput = Omit<Setting, "webPasswordHash">;

export interface InitSettingInput extends SettingBaseInput {
  webUsername: string;
  webPassword: string;
}

export interface UpdateSettingInput extends Partial<SettingBaseInput> {
  webPassword?: string;
}

function validateMediaTypes(mediaTypes: string[]) {
  for (const mediaType of mediaTypes) {
    if (!MEDIA_TYPES.includes(mediaType as (typeof MEDIA_TYPES)[number])) {
      throw new Error(`不支持的媒体类型: ${mediaType}`);
    }
  }
}

function buildClientKey(setting: Setting): string {
  return JSON.stringify({
    apiId: setting.apiId,
    apiHash: setting.apiHash,
    session: setting.session || "",
    proxy: setting.proxy || "",
  });
}

function parseProxy(proxy: string | undefined): SocksProxyType | undefined {
  if (!proxy) {
    return undefined;
  }

  try {
    const proxyUrl = new URL(proxy);
    if (proxyUrl.protocol === "socks5:" || proxyUrl.protocol === "socks4:") {
      return {
        ip: proxyUrl.hostname,
        port: Number.parseInt(proxyUrl.port, 10),
        socksType: proxyUrl.protocol === "socks5:" ? 5 : 4,
        username: proxyUrl.username || undefined,
        password: proxyUrl.password || undefined,
        timeout: 10,
      };
    }
  } catch (error) {
    logger.warn("代理 URL 格式错误", { proxy, error });
  }

  return undefined;
}

async function resolveSelfUserId(setting: Setting): Promise<number> {
  const nextClientKey = buildClientKey(setting);
  if (nextClientKey !== currentClientKey) {
    currentClientKey = nextClientKey;
    selfUserIdCache = null;
    resolvingSelfUserId = null;
  }

  if (selfUserIdCache !== null) {
    return selfUserIdCache;
  }

  if (!resolvingSelfUserId) {
    resolvingSelfUserId = (async () => {
      const session = new StringSession(setting.session || "");
      const clientParams: TelegramClientParams = {
        connectionRetries: 3,
        proxy: parseProxy(setting.proxy),
      };
      const client = new TelegramClient(
        session,
        setting.apiId,
        setting.apiHash,
        clientParams
      );

      try {
        await client.connect();
        const isAuthorized = await client.isUserAuthorized();
        if (!isAuthorized) {
          throw new Error("用户客户端未授权，无法获取默认允许用户");
        }

        const me = await client.getMe();
        const selfUserId = Number(me.id);
        if (!Number.isSafeInteger(selfUserId) || selfUserId <= 0) {
          throw new Error("无法获取有效的 Telegram 用户 ID");
        }

        selfUserIdCache = selfUserId;
        return selfUserId;
      } finally {
        await client.disconnect();
      }
    })().finally(() => {
      resolvingSelfUserId = null;
    });
  }

  return resolvingSelfUserId;
}

function validateSettingShape(setting: Partial<SettingBaseInput>) {
  if (setting.botToken !== undefined && typeof setting.botToken !== "string") {
    throw new Error("botToken 必须是字符串");
  }
  if (typeof setting.apiId !== "number") {
    throw new Error("apiId 必填且必须是数字");
  }
  if (!setting.apiHash || typeof setting.apiHash !== "string") {
    throw new Error("apiHash 必填且必须是字符串");
  }
  if (!setting.downloadDir || typeof setting.downloadDir !== "string") {
    throw new Error("downloadDir 必填且必须是字符串");
  }
  if (
    setting.logLevel !== undefined &&
    setting.logLevel !== "debug" &&
    setting.logLevel !== "info" &&
    setting.logLevel !== "warn" &&
    setting.logLevel !== "error"
  ) {
    throw new Error("logLevel 必须是 debug/info/warn/error 之一");
  }
  if (
    setting.downloadFileConcurrency !== undefined &&
    (typeof setting.downloadFileConcurrency !== "number" ||
      !Number.isInteger(setting.downloadFileConcurrency))
  ) {
    throw new Error("downloadFileConcurrency 必须是整数");
  }
  if (
    setting.downloadFileConcurrency !== undefined &&
    (setting.downloadFileConcurrency < 1 || setting.downloadFileConcurrency > 8)
  ) {
    throw new Error("downloadFileConcurrency 必须在 1 到 8 之间");
  }
  if (!Array.isArray(setting.allowedUserIds)) {
    throw new Error("allowedUserIds 必填且必须是数字数组");
  }
  if (!Array.isArray(setting.mediaTypes)) {
    throw new Error("mediaTypes 必填且必须是字符串数组");
  }
}

function validateWebAuthInput(username: string, password: string) {
  if (!username.trim()) {
    throw new Error("webUsername 必填且必须是字符串");
  }
  if (!password.trim()) {
    throw new Error("webPassword 必填且必须是字符串");
  }
}

export function updateSetting(patch: UpdateSettingInput) {
  if (!isConfigured()) {
    throw new Error("配置尚未初始化，请先调用初始化接口");
  }

  if (
    patch.mediaTypes &&
    (!Array.isArray(patch.mediaTypes) ||
      patch.mediaTypes.some(item => typeof item !== "string"))
  ) {
    throw new Error("mediaTypes 必须是字符串数组");
  }

  if (patch.mediaTypes) {
    validateMediaTypes(patch.mediaTypes);
  }

  if (patch.allowedUserIds !== undefined) {
    if (
      !Array.isArray(patch.allowedUserIds) ||
      patch.allowedUserIds.some(item => typeof item !== "number")
    ) {
      throw new Error("allowedUserIds 必须是数字数组");
    }
    if (patch.allowedUserIds.length === 0) {
      throw new Error("allowedUserIds 更新时不能为空");
    }
  }

  if (patch.apiId !== undefined && typeof patch.apiId !== "number") {
    throw new Error("apiId 必须是数字");
  }
  if (
    patch.webPassword !== undefined &&
    typeof patch.webPassword !== "string"
  ) {
    throw new Error("webPassword 必须是字符串");
  }
  if (patch.logLevel !== undefined) {
    if (
      patch.logLevel !== "debug" &&
      patch.logLevel !== "info" &&
      patch.logLevel !== "warn" &&
      patch.logLevel !== "error"
    ) {
      throw new Error("logLevel 必须是 debug/info/warn/error 之一");
    }
  }
  if (patch.downloadFileConcurrency !== undefined) {
    if (
      typeof patch.downloadFileConcurrency !== "number" ||
      !Number.isInteger(patch.downloadFileConcurrency)
    ) {
      throw new Error("downloadFileConcurrency 必须是整数");
    }
    if (
      patch.downloadFileConcurrency < 1 ||
      patch.downloadFileConcurrency > 8
    ) {
      throw new Error("downloadFileConcurrency 必须在 1 到 8 之间");
    }
  }

  const currentSetting = getSetting();
  if (!currentSetting) {
    throw new Error("配置尚未初始化，请先调用初始化接口");
  }

  const { webPassword, ...restPatch } = patch;
  const stringFields = [
    "botToken",
    "apiHash",
    "session",
    "downloadDir",
    "proxy",
    "webUsername",
  ] as const;
  for (const field of stringFields) {
    const value = restPatch[field];
    if (value !== undefined && typeof value !== "string") {
      throw new Error(`${field} 必须是字符串`);
    }
  }

  const nextSetting: Setting = {
    ...currentSetting,
    ...restPatch,
  };

  if (patch.webUsername !== undefined || webPassword !== undefined) {
    const nextUsername = (
      patch.webUsername ??
      (currentSetting?.webUsername || "")
    ).trim();
    const nextPassword = webPassword?.trim();

    if (!nextUsername) {
      throw new Error("webUsername 必填且必须是字符串");
    }

    if (webPassword !== undefined) {
      if (!nextPassword) {
        throw new Error("webPassword 必填且必须是字符串");
      }
      const credentials = createWebAuthCredential(nextUsername, nextPassword);
      nextSetting.webUsername = credentials.webUsername;
      nextSetting.webPasswordHash = credentials.webPasswordHash;
      revokeAllWebAuthSessions();
    } else {
      nextSetting.webUsername = nextUsername;
      revokeAllWebAuthSessions();
    }
  }

  const saved = saveSetting(nextSetting);
  reloadSetting();
  return saved;
}

export async function initSetting(input: InitSettingInput): Promise<Setting> {
  if (isConfigured()) {
    throw new Error("配置已存在，请使用更新接口");
  }

  validateSettingShape(input);
  validateMediaTypes(input.mediaTypes);
  validateWebAuthInput(input.webUsername, input.webPassword);
  const credentials = createWebAuthCredential(
    input.webUsername,
    input.webPassword
  );
  const { webPassword: _webPassword, ...setting } = input;

  const normalizedSetting: Setting =
    setting.allowedUserIds.length === 0
      ? {
          ...setting,
          webUsername: credentials.webUsername,
          webPasswordHash: credentials.webPasswordHash,
          downloadFileConcurrency:
            setting.downloadFileConcurrency ??
            DEFAULT_DOWNLOAD_FILE_CONCURRENCY,
          logLevel: setting.logLevel ?? DEFAULT_LOG_LEVEL,
          allowedUserIds: [await resolveSelfUserId(setting)],
        }
      : {
          ...setting,
          webUsername: credentials.webUsername,
          webPasswordHash: credentials.webPasswordHash,
          downloadFileConcurrency:
            setting.downloadFileConcurrency ??
            DEFAULT_DOWNLOAD_FILE_CONCURRENCY,
          logLevel: setting.logLevel ?? DEFAULT_LOG_LEVEL,
        };

  const saved = saveSetting(normalizedSetting);
  reloadSetting();
  return saved;
}
