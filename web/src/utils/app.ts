import type { TFunction } from "i18next"
import type { Setting, SettingForm, TaskStatus } from "@/types/app"

export function statusTone(
  status: TaskStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default"
  if (status === "failed") return "outline"
  if (status === "canceled") return "outline"
  if (status === "running") return "secondary"
  return "outline"
}

export function statusLabel(status: TaskStatus): string {
  if (status === "pending") return "排队中"
  if (status === "running") return "进行中"
  if (status === "completed") return "已完成"
  if (status === "canceled") return "已取消"
  return "失败"
}

export function taskTypeLabel(type: string): string {
  if (type === "link_download") return "链接下载"
  if (type === "bot_message_download") return "消息下载"
  return type
}

export function toForm(setting: Setting): SettingForm {
  let proxyType: SettingForm["proxyType"] = "none"
  let proxyHost = ""
  let proxyPort = ""
  let proxyUsername = ""
  let proxyPassword = ""

  if (setting.proxy) {
    try {
      const proxyUrl = new URL(setting.proxy)
      if (proxyUrl.protocol === "socks5:" || proxyUrl.protocol === "socks4:") {
        proxyType = proxyUrl.protocol === "socks5:" ? "socks5" : "socks4"
        proxyHost = proxyUrl.hostname
        proxyPort = proxyUrl.port
        proxyUsername = decodeURIComponent(proxyUrl.username)
        proxyPassword = decodeURIComponent(proxyUrl.password)
      }
    } catch {
      // ignore malformed proxy and fallback to empty form
    }
  }

  return {
    botToken: setting.botToken || "",
    apiId: String(setting.apiId),
    apiHash: setting.apiHash,
    downloadDir: setting.downloadDir,
    downloadFileConcurrency: String(setting.downloadFileConcurrency ?? 3),
    logLevel: setting.logLevel ?? "info",
    proxyType,
    proxyHost,
    proxyPort,
    proxyUsername,
    proxyPassword,
  }
}

export function buildProxyUrl(form: SettingForm): string | undefined {
  if (form.proxyType === "none") {
    return undefined
  }

  const host = form.proxyHost.trim()
  if (!host) {
    return undefined
  }

  const port = form.proxyPort.trim()
  if (!port || Number.isNaN(Number(port))) {
    return undefined
  }

  const username = form.proxyUsername.trim()
  const password = form.proxyPassword.trim()
  const auth =
    username || password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : ""

  return `${form.proxyType}://${auth}${host}:${port}`
}

export function parseCsvNumbers(input: string, t?: TFunction): number[] {
  if (!input.trim()) {
    return []
  }

  const values = input
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .map(value => Number(value))

  if (values.some(value => Number.isNaN(value))) {
    const errorMsg = t ? t("validation.user_ids_invalid") : "允许用户 ID 必须是逗号分隔的数字"
    throw new Error(errorMsg)
  }

  return values
}

export function validateStepOne(
  form: SettingForm,
  allowedUserIdsInput: string,
  mediaTypes: string[],
  t: TFunction
): string[] {
  const issues: string[] = []

  if (!form.apiId.trim()) {
    issues.push(t("validation.api_id_required"))
  } else if (Number.isNaN(Number(form.apiId))) {
    issues.push(t("validation.api_id_invalid"))
  }

  if (!form.apiHash.trim()) {
    issues.push(t("validation.api_hash_required"))
  }

  if (!form.downloadDir.trim()) {
    issues.push(t("validation.download_dir_required"))
  }
  if (!form.downloadFileConcurrency.trim()) {
    issues.push(t("validation.download_concurrency_required"))
  } else {
    const concurrency = Number(form.downloadFileConcurrency)
    if (Number.isNaN(concurrency) || !Number.isInteger(concurrency)) {
      issues.push(t("validation.download_concurrency_invalid"))
    } else if (concurrency < 1 || concurrency > 8) {
      issues.push(t("validation.download_concurrency_range"))
    }
  }

  if (mediaTypes.length === 0) {
    issues.push(t("validation.media_type_required"))
  }

  if (form.proxyType !== "none") {
    if (!form.proxyHost.trim()) {
      issues.push(t("validation.proxy_host_required"))
    }
    const port = Number(form.proxyPort.trim())
    if (!form.proxyPort.trim() || Number.isNaN(port) || !Number.isInteger(port)) {
      issues.push(t("validation.proxy_port_invalid"))
    } else if (port <= 0 || port > 65535) {
      issues.push(t("validation.proxy_port_range"))
    }
  }

  const rawIds = allowedUserIdsInput.trim()
  if (rawIds) {
    const hasInvalid = rawIds
      .split(",")
      .map(item => item.trim())
      .filter(Boolean)
      .some(item => Number.isNaN(Number(item)))

    if (hasInvalid) {
      issues.push(t("validation.user_ids_invalid"))
    }
  }

  return issues
}

export function normalizeSettingPayload(
  form: SettingForm,
  allowedUserIdsInput: string,
  mediaTypes: string[],
  t: TFunction,
  session?: string
): Setting {
  const apiId = Number(form.apiId)
  if (Number.isNaN(apiId)) {
    throw new Error(t("validation.api_id_invalid"))
  }
  const downloadFileConcurrency = Number(form.downloadFileConcurrency)
  if (Number.isNaN(downloadFileConcurrency) || !Number.isInteger(downloadFileConcurrency)) {
    throw new Error(t("validation.download_concurrency_invalid"))
  }
  if (downloadFileConcurrency < 1 || downloadFileConcurrency > 8) {
    throw new Error(t("validation.download_concurrency_range"))
  }

  if (mediaTypes.length === 0) {
    throw new Error(t("validation.media_type_required"))
  }

  const botToken = form.botToken.trim()
  const proxy = buildProxyUrl(form)

  return {
    ...(botToken ? { botToken } : {}),
    apiId,
    apiHash: form.apiHash.trim(),
    ...(session ? { session } : {}),
    downloadDir: form.downloadDir.trim(),
    downloadFileConcurrency,
    logLevel: form.logLevel,
    allowedUserIds: parseCsvNumbers(allowedUserIdsInput, t),
    mediaTypes,
    proxy,
  }
}
