import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import {
  getSetting,
  isConfigured,
  reloadSetting,
  type Setting,
} from "@/services/config-service.js";
import {
  type InitSettingInput,
  initSetting,
  type UpdateSettingInput,
  updateSetting,
} from "@/services/setting-management-service.js";
import {
  cancelTask,
  createLinkDownloadTask,
  getTask,
  listTasks,
  subscribeTaskEvents,
} from "@/services/task-service.js";
import {
  sendTelegramLoginCode,
  testTelegramProxyConnection,
  verifyTelegramLoginCode,
} from "@/services/telegram-auth-service.js";
import {
  createWebAuthSession,
  hasWebAuthCredentialConfigured,
  revokeWebAuthSession,
  validateWebAuthSession,
  verifyWebAuthLogin,
  WEB_AUTH_COOKIE_NAME,
  WEB_AUTH_SESSION_MAX_AGE_SECONDS,
} from "@/services/web-auth-service.js";

interface CreateTaskPayload {
  type: "link_download";
  messageLink: string;
}

interface SendLoginCodePayload {
  apiId: number;
  apiHash: string;
  proxy?: string;
  phoneNumber: string;
}

interface TestProxyPayload {
  apiId: number;
  apiHash: string;
  proxy?: string;
}

interface VerifyLoginCodePayload extends SendLoginCodePayload {
  phoneCode: string;
  password?: string;
}

interface WebLoginPayload {
  username: string;
  password: string;
}

type ClientSetting = Omit<Setting, "webPasswordHash">;

const app = new Hono();

app.use("*", cors());

const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/config/status",
  "/api/config/init",
  "/api/auth/web/status",
  "/api/auth/web/login",
  "/api/auth/web/logout",
]);

function toClientSetting(setting: Setting | null): ClientSetting | null {
  if (!setting) {
    return null;
  }
  const { webPasswordHash: _webPasswordHash, ...rest } = setting;
  return rest;
}

app.use("/api/*", async (c, next) => {
  if (PUBLIC_API_PATHS.has(c.req.path)) {
    await next();
    return;
  }

  const setting = getSetting();
  if (!setting || !hasWebAuthCredentialConfigured(setting)) {
    await next();
    return;
  }

  const token = getCookie(c, WEB_AUTH_COOKIE_NAME);
  if (!token || !validateWebAuthSession(token, setting.webUsername!)) {
    return c.json(
      {
        message: "未登录或登录已过期，请先登录",
      },
      401
    );
  }

  await next();
});

// Initialize static file serving
const staticRoot = "./web/dist";

// Serve static assets from /assets
app.use("/assets/*", serveStatic({ root: staticRoot }));

// Serve favicons and other root files if they exist in dist
app.use("/favicon.ico", serveStatic({ root: staticRoot }));
app.use("/manifest.json", serveStatic({ root: staticRoot }));
app.use("/logo.png", serveStatic({ root: staticRoot })); // adjust as needed
app.use("/icon.svg", serveStatic({ root: staticRoot }));

// For any other non-API route, serve index.html (SPA Fallback)
// make sure this is AFTER specific API routes but BEFORE error handlers if any
// However, since Hono matches routes in order and we have specific /api routes below,
// we need a catch-all route at the END or rely on specificity.
// A common pattern for SPA is to serve index.html for all GET requests that accept text/html
// and don't match static files or API.

app.get("/api/health", c => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/config", c => {
  return c.json({
    configured: isConfigured(),
    data: toClientSetting(getSetting()),
  });
});

app.get("/api/config/status", c => {
  return c.json({
    configured: isConfigured(),
  });
});

app.post("/api/config/init", async c => {
  try {
    const payload = await c.req.json<InitSettingInput>();
    const setting = await initSetting(payload);
    return c.json(
      {
        message: "配置初始化完成",
        data: toClientSetting(setting),
      },
      201
    );
  } catch (error) {
    return c.json(
      {
        message: error instanceof Error ? error.message : "配置初始化失败",
      },
      400
    );
  }
});

app.put("/api/config", async c => {
  try {
    const payload = await c.req.json<UpdateSettingInput>();
    updateSetting(payload);
    const setting = reloadSetting();
    return c.json({
      message: "配置已更新",
      data: toClientSetting(setting),
    });
  } catch (error) {
    return c.json(
      {
        message: error instanceof Error ? error.message : "配置更新失败",
      },
      400
    );
  }
});

app.get("/api/auth/web/status", c => {
  const setting = getSetting();
  const authConfigured = hasWebAuthCredentialConfigured(setting);
  const token = getCookie(c, WEB_AUTH_COOKIE_NAME);
  const authenticated =
    Boolean(
      setting &&
        authConfigured &&
        token &&
        validateWebAuthSession(token, setting.webUsername!)
    ) || !authConfigured;

  return c.json({
    configured: isConfigured(),
    authConfigured,
    authenticated,
  });
});

app.post("/api/auth/web/login", async c => {
  try {
    const setting = getSetting();
    if (!setting || !isConfigured()) {
      return c.json(
        {
          message: "配置尚未初始化，请先完成初始化",
        },
        400
      );
    }
    if (!hasWebAuthCredentialConfigured(setting)) {
      return c.json(
        {
          message: "未配置 Web 登录账号，请重新初始化配置",
        },
        400
      );
    }

    const payload = await c.req.json<WebLoginPayload>();
    if (!payload.username?.trim() || !payload.password?.trim()) {
      return c.json(
        {
          message: "账号和密码不能为空",
        },
        400
      );
    }

    const ok = verifyWebAuthLogin(setting, payload.username, payload.password);
    if (!ok) {
      return c.json(
        {
          message: "账号或密码错误",
        },
        401
      );
    }

    const sessionToken = createWebAuthSession(setting.webUsername!);
    setCookie(c, WEB_AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: WEB_AUTH_SESSION_MAX_AGE_SECONDS,
    });

    return c.json({
      message: "登录成功",
      data: {
        ok: true,
      },
    });
  } catch (error) {
    return c.json(
      {
        message: error instanceof Error ? error.message : "登录失败",
      },
      400
    );
  }
});

app.post("/api/auth/web/logout", c => {
  const token = getCookie(c, WEB_AUTH_COOKIE_NAME);
  if (token) {
    revokeWebAuthSession(token);
  }
  deleteCookie(c, WEB_AUTH_COOKIE_NAME, {
    path: "/",
  });
  return c.json({
    message: "已退出登录",
    data: {
      ok: true,
    },
  });
});

app.post("/api/auth/telegram/send-code", async c => {
  try {
    const payload = await c.req.json<SendLoginCodePayload>();
    const data = await sendTelegramLoginCode(payload);
    return c.json({
      message: "验证码已发送",
      data,
    });
  } catch (error) {
    return c.json(
      {
        message: error instanceof Error ? error.message : "验证码发送失败",
      },
      400
    );
  }
});

app.post("/api/auth/telegram/test-proxy", async c => {
  try {
    const payload = await c.req.json<TestProxyPayload>();
    await testTelegramProxyConnection(payload);
    return c.json({
      message: "代理连接测试成功",
      data: {
        ok: true,
      },
    });
  } catch (error) {
    return c.json(
      {
        message: error instanceof Error ? error.message : "代理连接测试失败",
      },
      400
    );
  }
});

app.post("/api/auth/telegram/verify", async c => {
  try {
    const payload = await c.req.json<VerifyLoginCodePayload>();
    const data = await verifyTelegramLoginCode(payload);
    return c.json({
      message: data.needPassword ? "需要二次密码" : "登录验证成功",
      data,
    });
  } catch (error) {
    return c.json(
      {
        message: error instanceof Error ? error.message : "登录验证失败",
      },
      400
    );
  }
});

app.post("/api/tasks", async c => {
  try {
    if (!isConfigured()) {
      return c.json(
        {
          message: "配置尚未初始化，请先在前端完成配置初始化。",
        },
        400
      );
    }

    const payload = await c.req.json<CreateTaskPayload>();
    if (payload.type !== "link_download") {
      return c.json(
        {
          message: "仅支持 link_download 任务类型",
        },
        400
      );
    }
    if (!payload.messageLink || typeof payload.messageLink !== "string") {
      return c.json(
        {
          message: "messageLink 必填且必须是字符串",
        },
        400
      );
    }

    const task = createLinkDownloadTask(payload.messageLink);
    return c.json(
      {
        message: "任务已创建",
        data: task,
      },
      201
    );
  } catch (error) {
    return c.json(
      {
        message: error instanceof Error ? error.message : "任务创建失败",
      },
      400
    );
  }
});

app.get("/api/tasks", c => {
  return c.json({
    data: listTasks(),
  });
});

app.get("/api/tasks/stream", c => {
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
          )
        );
      };

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        if (unsubscribe) {
          unsubscribe();
        }
        controller.close();
      };

      send("snapshot", {
        tasks: listTasks(),
      });

      unsubscribe = subscribeTaskEvents(event => {
        send("task_update", event);
      });

      heartbeatTimer = setInterval(() => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
      }, 15_000);

      c.req.raw.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

app.get("/api/tasks/:taskId", c => {
  const taskId = c.req.param("taskId");
  const task = getTask(taskId);
  if (!task) {
    return c.json(
      {
        message: "任务不存在",
      },
      404
    );
  }

  return c.json({
    data: task,
  });
});

app.get("/api/tasks/:taskId/progress", c => {
  const taskId = c.req.param("taskId");
  const task = getTask(taskId);
  if (!task) {
    return c.json(
      {
        message: "任务不存在",
      },
      404
    );
  }

  return c.json({
    data: {
      id: task.id,
      status: task.status,
      progress: task.progress,
      updatedAt: task.updatedAt,
    },
  });
});

app.post("/api/tasks/:taskId/cancel", c => {
  const taskId = c.req.param("taskId");
  try {
    const task = cancelTask(taskId);
    return c.json({
      message: "任务已取消",
      data: task,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "任务取消失败";
    const status = message.includes("不存在") ? 404 : 400;
    return c.json(
      {
        message,
      },
      status
    );
  }
});

// SPA Fallback: serve index.html for any unknown GET request
// This must be the Last route handler
app.get("*", serveStatic({ path: "./web/dist/index.html" }));

export { app };
