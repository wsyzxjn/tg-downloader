import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  getSetting,
  isConfigured,
  reloadSetting,
  type Setting,
} from "@/services/config-service.js";
import {
  initSetting,
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

const app = new Hono();

app.use("*", cors());

// Initialize static file serving
const staticRoot = "./web/dist";

// Serve static assets from /assets
app.use("/assets/*", serveStatic({ root: staticRoot }));

// Serve favicons and other root files if they exist in dist
app.use("/favicon.ico", serveStatic({ root: staticRoot }));
app.use("/manifest.json", serveStatic({ root: staticRoot }));
app.use("/logo.png", serveStatic({ root: staticRoot })); // adjust as needed

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
    data: getSetting(),
  });
});

app.get("/api/config/status", c => {
  return c.json({
    configured: isConfigured(),
  });
});

app.post("/api/config/init", async c => {
  try {
    const payload = await c.req.json<Setting>();
    const setting = await initSetting(payload);
    return c.json(
      {
        message: "配置初始化完成",
        data: setting,
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
    const payload = await c.req.json<Partial<Setting>>();
    updateSetting(payload);
    const setting = reloadSetting();
    return c.json({
      message: "配置已更新",
      data: setting,
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
