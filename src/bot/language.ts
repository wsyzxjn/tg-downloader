import { getSetting } from "@/services/config-service.js";

export type Lang = "zh" | "en";

const userLanguageMap = new Map<number, Lang>();

export function normalizeLang(value: string | undefined): Lang | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "zh" || normalized === "cn" || normalized === "中文") {
    return "zh";
  }
  if (normalized === "en" || normalized === "english") {
    return "en";
  }
  return null;
}

export function resolveUserLang(ctx: {
  from?: { id: number; language_code?: string };
}): Lang {
  const userId = ctx.from?.id;
  if (userId) {
    const assigned = userLanguageMap.get(userId);
    if (assigned) {
      return assigned;
    }
  }

  const code = ctx.from?.language_code?.toLowerCase();
  if (code?.startsWith("zh")) {
    return "zh";
  }
  return "en";
}

export function assignUserLang(userId: number, lang: Lang) {
  userLanguageMap.set(userId, lang);
}

export function buildUsageText(lang: Lang) {
  const currentSetting = getSetting();
  const enabledMediaTypes = currentSetting?.mediaTypes?.join(
    lang === "zh" ? "、" : ", "
  );

  if (lang === "en") {
    return [
      "👋 Welcome to TG Download Bot!",
      "",
      "How to use:",
      "1. Send or forward a message with media",
      "2. Send a Telegram message link (t.me/...)",
      "",
      `Allowed media types: ${enabledMediaTypes || "Not configured"}`,
    ].join("\n");
  }

  return [
    "👋 欢迎使用 TG Download Bot！",
    "",
    "可用方式：",
    "1. 直接发送或转发包含附件的消息",
    "2. 发送 Telegram 消息链接（t.me/...）",
    "",
    `当前允许下载类型：${enabledMediaTypes || "未配置"}`,
  ].join("\n");
}
