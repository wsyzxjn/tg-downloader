import { createLogger } from "@/services/logger.js";

const logger = createLogger("openlist-service");

export interface OpenListConfig {
  baseUrl: string;
  username: string;
  password: string;
  targetDir?: string;
  asTask?: boolean;
}

export interface OpenListUploadOptions {
  targetFilePath: string;
  stream: ReadableStream<Uint8Array>;
  contentLength: number;
  asTask?: boolean;
  overwrite?: boolean;
  signal?: AbortSignal;
}

export interface OpenListUploadResult {
  filePath: string;
  asTask: boolean;
}

export interface OpenListTestResult {
  ok: boolean;
  message: string;
  username?: string;
}

export class OpenListClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private readonly baseUrl: string;

  constructor(private readonly config: OpenListConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  /**
   * 获取有效的 JWT Token。
   */
  async getAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.tokenExpiresAt > now + 60_000) {
      return this.token;
    }

    logger.debug("请求 OpenList 登录认证", {
      baseUrl: this.baseUrl,
      username: this.config.username,
    });

    const loginUrl = `${this.baseUrl}/api/auth/login`;
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
      data?: { token?: string };
    };

    if (!res.ok || json.code !== 200 || !json.data?.token) {
      const msg = json.message || `HTTP ${res.status}`;
      logger.error("OpenList 登录失败", { error: msg });
      throw new Error(`OpenList 登录失败: ${msg}`);
    }

    this.token = json.data.token;
    // 默认缓存 2 小时
    this.tokenExpiresAt = now + 2 * 3600 * 1000;
    return this.token;
  }

  /**
   * 测试连接与凭证有效性。
   */
  async testConnection(): Promise<OpenListTestResult> {
    try {
      const token = await this.getAuthToken();
      const meRes = await fetch(`${this.baseUrl}/api/me`, {
        headers: {
          Authorization: token,
        },
      });

      if (meRes.ok) {
        const meJson = (await meRes.json().catch(() => ({}))) as {
          code?: number;
          data?: { username?: string };
        };
        return {
          ok: true,
          message: "连接并登录成功",
          username: meJson.data?.username || this.config.username,
        };
      }

      return {
        ok: true,
        message: "登录成功",
        username: this.config.username,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 确保目标挂载目录存在。
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    const cleanDir = dirPath.startsWith("/") ? dirPath : `/${dirPath}`;
    if (cleanDir === "/" || !cleanDir) {
      return;
    }

    const token = await this.getAuthToken();
    try {
      const res = await fetch(`${this.baseUrl}/api/fs/mkdir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ path: cleanDir }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        logger.debug("OpenList mkdir 响应 (可能目录已存在)", {
          path: cleanDir,
          message: json.message,
        });
      }
    } catch (err) {
      logger.warn("OpenList 自动创建目录尝试异常", { path: cleanDir, err });
    }
  }

  /**
   * 不落盘流式直传到 OpenList (PUT /api/fs/put)。
   */
  async uploadStream(
    options: OpenListUploadOptions
  ): Promise<OpenListUploadResult> {
    const token = await this.getAuthToken();
    const cleanPath = options.targetFilePath.startsWith("/")
      ? options.targetFilePath
      : `/${options.targetFilePath}`;

    const asTask =
      options.asTask ??
      this.config.asTask ??
      options.contentLength > 300 * 1024 * 1024;
    const overwrite = options.overwrite ?? true;

    logger.info("开始流式上传到 OpenList", {
      path: cleanPath,
      contentLength: options.contentLength,
      asTask,
    });

    const headers: Record<string, string> = {
      Authorization: token,
      "File-Path": encodeURI(cleanPath),
      "Content-Length": String(options.contentLength),
      "Content-Type": "application/octet-stream",
      Overwrite: overwrite ? "true" : "false",
      "As-Task": asTask ? "true" : "false",
    };

    const putUrl = `${this.baseUrl}/api/fs/put`;
    const res = await fetch(putUrl, {
      method: "PUT",
      headers,
      body: options.stream,
      duplex: "half",
      signal: options.signal,
    } as RequestInit & { duplex: string });

    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
    };

    if (!res.ok || (json.code !== undefined && json.code !== 200)) {
      const msg = json.message || `HTTP ${res.status}`;
      logger.error("OpenList 流式上传失败", { path: cleanPath, error: msg });
      throw new Error(`OpenList 上传失败: ${msg}`);
    }

    logger.info("OpenList 流式上传已成功接收", { path: cleanPath, asTask });

    return {
      filePath: cleanPath,
      asTask,
    };
  }
}
