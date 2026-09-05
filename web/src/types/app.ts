export type TaskStatus = "pending" | "running" | "completed" | "failed" | "canceled"
export type ThemeMode = "system" | "light" | "dark"
export type LogLevel = "debug" | "info" | "warn" | "error"
export type StorageTarget = "local" | "openlist"

export interface Setting {
  webUsername?: string
  botToken?: string
  apiId: number
  apiHash: string
  session?: string
  downloadDir: string
  downloadFileConcurrency: number
  logLevel: LogLevel
  allowedUserIds: number[]
  mediaTypes: string[]
  proxy?: string
  tdlPath?: string
  tdlNamespace?: string
  tdlStorage?: string
  tdlThreads?: number
  storageTarget?: StorageTarget
  openListEnabled?: boolean
  openListBaseUrl?: string
  openListUsername?: string
  openListPassword?: string
  openListTargetDir?: string
  openListAsTask?: boolean
}

export interface SettingForm {
  webUsername: string
  webPassword: string
  botToken: string
  apiId: string
  apiHash: string
  downloadDir: string
  downloadFileConcurrency: string
  logLevel: LogLevel
  proxyType: "none" | "socks5" | "socks4"
  proxyHost: string
  proxyPort: string
  proxyUsername: string
  proxyPassword: string
  tdlPath: string
  tdlNamespace: string
  tdlStorage: string
  tdlThreads: string
  storageTarget: StorageTarget
  openListEnabled: boolean
  openListBaseUrl: string
  openListUsername: string
  openListPassword: string
  openListTargetDir: string
  openListAsTask: boolean
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
    destination?: "local" | "openlist"
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

export interface WebAuthStatusResponse {
  configured: boolean
  authConfigured: boolean
  authenticated: boolean
}

export interface TelegramAuthVerifyResponse {
  needPassword: boolean
  session?: string
  userId?: number
  firstName?: string
  username?: string
}

export interface TdlStatusResponse {
  installed: boolean
  path?: string
  version?: string
  authorized: boolean
  namespace: string
  error?: string
}

export interface OpenListTestResponse {
  ok: boolean
  message: string
  username?: string
}
