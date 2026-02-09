import type { Context, MiddlewareFn } from "grammy";
import { MEDIA_TYPES } from "@/constants/media-types.js";
import type { TrackTaskMeta } from "@/services/bot-task-progress-service.js";
import { getSetting } from "@/services/config-service.js";
import { getFileInfo } from "@/services/file-info-service.js";
import { createLogger } from "@/services/logger.js";
import {
  createBotMessageDownloadTask,
  findActiveTaskBySourceKey,
} from "@/services/task-service.js";

interface MediaDownloadMiddlewareOptions {
  trackTaskProgress: (ctx: Context, meta: TrackTaskMeta) => Promise<void>;
}
const logger = createLogger("middleware-media-download");

/**
 * 创建附件下载中间件。
 * @param options 中间件配置
 * @returns grammy 中间件函数
 */
export function createMediaDownloadMiddleware(
  options: MediaDownloadMiddlewareOptions
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const setting = getSetting();
    if (!setting) {
      await next();
      return;
    }
    const mediaTypes = setting.mediaTypes;
    const filters = mediaTypes
      .filter(type => MEDIA_TYPES.includes(type))
      .map(type => `message:${type}` as const);

    if (!ctx.has(filters)) {
      await next();
      return;
    }

    const fileInfo = getFileInfo(ctx.message!);
    if (!fileInfo) {
      logger.warn("无法获取文件信息");
      await next();
      return;
    }

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

    try {
      logger.info("开始下载消息媒体", {
        fileName: fileInfo.fileName,
        mediaType: fileInfo.mediaType,
      });
      const task = createBotMessageDownloadTask(
        ctx.message!,
        fileInfo,
        sourceKey
      );
      await options.trackTaskProgress(ctx, {
        taskId: task.id,
        fileName: fileInfo.fileName,
        mediaType: fileInfo.mediaType,
        fileSize: fileInfo.fileSize,
      });
    } catch (error) {
      logger.error("消息媒体下载触发失败", error);
    }
  };
}
