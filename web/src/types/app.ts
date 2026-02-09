export type TaskStatus = "pending" | "running" | "completed" | "failed" | "canceled"
export type ThemeMode = "system" | "light" | "dark"

export interface Setting {
  botToken?: string
  apiId: number
  apiHash: string
  session?: string
  downloadDir: string
  downloadFileConcurrency: number
  allowedUserIds: number[]
  mediaTypes: string[]
  proxy?: string
}

export interface SettingForm {
  botToken: string
  apiId: string
  apiHash: string
  downloadDir: string
  downloadFileConcurrency: string
  proxyType: "none" | "socks5" | "socks4"
  proxyHost: string
  proxyPort: string
  proxyUsername: string
  proxyPassword: string
}

export interface TaskRecord {
  id: string
  type: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  progress: {
    percent: number
    downloaded?: number
    total?: number
    speedBytesPerSec?: number
  }
  result?: {
    filePath?: string
    fileName?: string
    filePaths?: string[]
    fileNames?: string[]
    error?: string
  }
}

export interface ConfigResponse {
  configured: boolean
  data: Setting | null
}

export interface TelegramAuthVerifyResponse {
  needPassword: boolean
  session?: string
  userId?: number
  firstName?: string
  username?: string
}
