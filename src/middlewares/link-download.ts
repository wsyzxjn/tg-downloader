import type { Context, MiddlewareFn } from "grammy";
import type { TrackTaskMeta } from "@/services/bot-task-progress-service.js";
import { createLogger } from "@/services/logger.js";
import {
  createLinkDownloadTask,
  findActiveTaskBySourceKey,
} from "@/services/task-service.js";

interface LinkDownloadMiddlewareOptions {
  trackTaskProgress: (ctx: Context, meta: TrackTaskMeta) => Promise<void>;
}
const logger = createLogger("middleware-link-download");

/**
 * 将文本解析为 Telegram 消息链接。
 * @param text 消息文本
 * @returns 规范化后的链接；不是纯链接时返回 null
 */
function extractTelegramMessageLink(text: string): string | null {
  const rawText = text.trim();
  if (!rawText) {
    return null;
  }

  const urlText =
    rawText.startsWith("http://") || rawText.startsWith("https://")
      ? rawText
      : `https://${rawText}`;

  try {
    const parsed = new URL(urlText);
    if (!["t.me", "telegram.me", "www.t.me"].includes(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * 创建 Telegram 消息链接下载中间件。
 * @param options 中间件配置
 * @returns grammy 中间件函数
 */
export function createLinkDownloadMiddleware(
  options: LinkDownloadMiddlewareOptions
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const text = ctx.message?.text || ctx.message?.caption;
    if (!text) {
      await next();
      return;
    }

    const tgLink = extractTelegramMessageLink(text);
    if (!tgLink) {
      await next();
      return;
    }

    try {
      logger.info("开始通过链接下载", { tgLink });
      const sourceKey = ctx.chat
        ? `bot_message:${ctx.chat.id}:${ctx.message!.message_id}`
        : undefined;

      if (sourceKey) {
        const activeTask = findActiveTaskBySourceKey(sourceKey);
        if (activeTask) {
          await ctx.reply(
            `⏭️ 该消息已有任务排队或进行中（${activeTask.id}），已忽略重复请求。`
          );
          return;
        }
      }

      const task = createLinkDownloadTask(tgLink, {
        sourceKey,
      });

      await options.trackTaskProgress(ctx, {
        taskId: task.id,
        fileName: "link_message",
        mediaType: "link",
      });
    } catch (error) {
      logger.error("链接下载触发失败", error);
      await ctx.reply("❌ 链接下载失败，请检查链接或权限");
    }
  };
}
