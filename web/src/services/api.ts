import type {
  ConfigResponse,
  Setting,
  TaskRecord,
  TelegramAuthVerifyResponse,
  WebAuthStatusResponse,
} from "@/types/app"

interface ApiEnvelope<T> {
  data?: T
  message?: string
}

export interface VerifyTelegramPayload {
  apiId: number
  apiHash: string
  proxy?: string
  phoneNumber: string
  phoneCode: string
  password?: string
}

export interface SendCodePayload {
  apiId: number
  apiHash: string
  proxy?: string
  phoneNumber: string
}

export interface TestProxyPayload {
  apiId: number
  apiHash: string
  proxy?: string
}

export interface InitSettingPayload extends Setting {
  webUsername: string
  webPassword: string
}

export interface WebLoginPayload {
  username: string
  password: string
}

export async function parseApiJson(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text()
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    const preview = raw.slice(0, 120).replace(/\s+/g, " ")
    throw new Error(`服务返回了非 JSON 响应（HTTP ${response.status}）: ${preview}`)
  }
}

async function readDataOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  const json = (await parseApiJson(response)) as ApiEnvelope<T>
  if (!response.ok) {
    throw new Error(json.message || fallbackMessage)
  }
  return json.data as T
}

export async function fetchConfig(): Promise<ConfigResponse> {
  const response = await fetch("/api/config")
  const json = (await parseApiJson(response)) as unknown as ConfigResponse & { message?: string }
  if (!response.ok) {
    throw new Error(json.message || "加载配置失败")
  }
  return json
}

export async function fetchWebAuthStatus(): Promise<WebAuthStatusResponse> {
  const response = await fetch("/api/auth/web/status")
  const json = await parseApiJson(response)
  if (!response.ok) {
    throw new Error(typeof json.message === "string" ? json.message : "获取登录状态失败")
  }
  return {
    configured: Boolean(json.configured),
    authConfigured: Boolean(json.authConfigured),
    authenticated: Boolean(json.authenticated),
  }
}

export async function loginWeb(payload: WebLoginPayload): Promise<void> {
  const response = await fetch("/api/auth/web/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  await readDataOrThrow<unknown>(response, "登录失败")
}

export async function logoutWeb(): Promise<void> {
  const response = await fetch("/api/auth/web/logout", {
    method: "POST",
  })
  await readDataOrThrow<unknown>(response, "退出登录失败")
}

export async function fetchTasks(): Promise<TaskRecord[]> {
  const response = await fetch("/api/tasks")
  return readDataOrThrow<TaskRecord[]>(response, "加载任务失败")
}

export async function saveConfig(payload: Setting): Promise<Setting> {
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  return readDataOrThrow<Setting>(response, "保存失败")
}

export async function initConfig(payload: InitSettingPayload): Promise<Setting> {
  const response = await fetch("/api/config/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  return readDataOrThrow<Setting>(response, "初始化失败")
}

export async function sendTelegramCode(payload: SendCodePayload): Promise<void> {
  const response = await fetch("/api/auth/telegram/send-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  await readDataOrThrow<unknown>(response, "验证码发送失败")
}

export async function verifyTelegramLogin(
  payload: VerifyTelegramPayload
): Promise<TelegramAuthVerifyResponse> {
  const response = await fetch("/api/auth/telegram/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  return readDataOrThrow<TelegramAuthVerifyResponse>(response, "登录验证失败")
}

export async function testTelegramProxy(payload: TestProxyPayload): Promise<void> {
  const response = await fetch("/api/auth/telegram/test-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  await readDataOrThrow<unknown>(response, "代理连接测试失败")
}

export async function createLinkTask(messageLink: string): Promise<{ id: string }> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "link_download",
      messageLink,
    }),
  })

  return readDataOrThrow<{ id: string }>(response, "创建任务失败")
}

export async function cancelTask(taskId: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/cancel`, {
    method: "POST",
  })
  await readDataOrThrow<unknown>(response, "取消任务失败")
}
