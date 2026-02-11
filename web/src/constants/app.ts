import type { SettingForm } from "@/types/app"

export const MEDIA_TYPE_OPTIONS = [
  "photo",
  "animation",
  "audio",
  "document",
  "video",
  "video_note",
  "voice",
  "sticker",
] as const

export const DEFAULT_SETTING_FORM: SettingForm = {
  webUsername: "",
  webPassword: "",
  botToken: "",
  apiId: "",
  apiHash: "",
  downloadDir: "./downloads",
  downloadFileConcurrency: "3",
  logLevel: "info",
  proxyType: "none",
  proxyHost: "",
  proxyPort: "",
  proxyUsername: "",
  proxyPassword: "",
}

export const DEFAULT_MEDIA_TYPES = [...MEDIA_TYPE_OPTIONS]
