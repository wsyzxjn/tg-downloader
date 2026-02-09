import type { Api, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { createLogger } from "@/services/logger.js";
import type { TaskRecord } from "@/services/task-service.js";
import {
  getTask,
  subscribeTaskEvents,
  type TaskEvent,
} from "@/services/task-service.js";

export interface TrackTaskMeta {
  taskId: string;
  fileName?: string;
  mediaType?: string;
  fileSize?: number;
}

interface TaskViewState {
  api: Api;
  chatId: number;
  messageId: number;
  fileName?: string;
  mediaType?: string;
  fileSize?: number;
  paused: boolean;
  lastPercent: number;
  lastEditAt: number;
  editQueue: Promise<void>;
}

const PROGRESS_BAR_WIDTH = 12;
const logger = createLogger("bot-task-progress");

function formatFileSize(fileSize: number | undefined): string {
  if (!fileSize || fileSize <= 0) {
    return "未知";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = fileSize;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const formatted = size >= 10 ? size.toFixed(0) : size.toFixed(1);
  return `${formatted}${units[unitIndex]}`;
}

function formatSpeed(speedBytesPerSec: number | undefined): string {
  if (!speedBytesPerSec || speedBytesPerSec <= 0) {
    return "未知";
  }
  return `${formatFileSize(speedBytesPerSec)}/s`;
}

function renderProgressBar(percent: number): string {
  const normalized = Math.max(0, Math.min(100, percent));
  const filled = Math.round((normalized / 100) * PROGRESS_BAR_WIDTH);
  const empty = PROGRESS_BAR_WIDTH - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

function renderCancelKeyboard(taskId: string) {
  return new InlineKeyboard().text("🛑 取消任务", `cancel_task:${taskId}`);
}

function renderTaskMessage(task: TaskRecord, view: TaskViewState): string {
  const percent =
    task.status === "completed" ? 100 : Math.max(0, task.progress.percent || 0);
  const title =
    task.status === "completed"
      ? "✅ 下载完成"
      : task.status === "failed"
        ? "❌ 下载失败"
        : task.status === "canceled"
          ? "🛑 任务已取消"
          : "⏬ 下载中";

  const speedText =
    task.status === "running"
      ? formatSpeed(task.progress.speedBytesPerSec)
      : "未知";

  return [
    title,
    `🆔 任务ID: ${task.id}`,
    `🧩 类型: ${view.mediaType || task.meta?.mediaType || "未知"}`,
    `📦 大小: ${formatFileSize(view.fileSize || task.meta?.fileSize)}`,
    `📁 文件: ${view.fileName || task.meta?.fileName || "未知文件"}`,
    `🚀 速度: ${speedText}`,
    `📊 [${renderProgressBar(percent)}] ${percent}%`,
  ].join("\n");
}

function createDefaultTask(taskId: string): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: taskId,
    type: "bot_message_download",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    progress: {
      downloaded: 0,
      total: 0,
      percent: 0,
    },
  };
}

export function createBotTaskProgressService() {
  const taskViews = new Map<string, TaskViewState>();
  let unsubscribe: (() => void) | null = null;

  const updateTaskView = (task: TaskRecord) => {
    const view = taskViews.get(task.id);
    if (!view) {
      return;
    }

    const running = task.status === "running" || task.status === "pending";
    if (view.paused && running) {
      return;
    }

    const now = Date.now();
    const percent = task.progress.percent || 0;
    if (task.status === "running") {
      const shouldEdit =
        percent - view.lastPercent >= 2 || now - view.lastEditAt >= 1500;
      if (!shouldEdit) {
        return;
      }
      view.lastPercent = percent;
      view.lastEditAt = now;
    }

    const text = renderTaskMessage(task, view);
    const withCancelButton = running;
    view.editQueue = view.editQueue
      .then(async () => {
        if (task.status === "canceled") {
          try {
            await view.api.deleteMessage(view.chatId, view.messageId);
          } catch (error) {
            logger.warn(`[task:${task.id}] delete failed`, error);
          } finally {
            taskViews.delete(task.id);
          }
          return;
        }

        try {
          await view.api.editMessageText(view.chatId, view.messageId, text, {
            reply_markup: withCancelButton
              ? renderCancelKeyboard(task.id)
              : undefined,
          });
          if (!withCancelButton) {
            taskViews.delete(task.id);
          }
        } catch (error) {
          logger.warn(`[task:${task.id}] edit failed`, error);
        }
      })
      .catch(() => {});
  };

  const onTaskEvent = (event: TaskEvent) => {
    if (event.type === "remove") {
      taskViews.delete(event.taskId);
      return;
    }
    if (!event.task) {
      return;
    }
    updateTaskView(event.task);
  };

  return {
    start() {
      if (unsubscribe) {
        return;
      }
      unsubscribe = subscribeTaskEvents(onTaskEvent);
    },
    stop() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      taskViews.clear();
    },
    async trackTaskProgress(ctx: Context, meta: TrackTaskMeta) {
      if (!ctx.chat) {
        return;
      }

      const task = getTask(meta.taskId) ?? createDefaultTask(meta.taskId);
      const initialView: TaskViewState = {
        api: ctx.api,
        chatId: Number(ctx.chat.id),
        messageId: 0,
        fileName: meta.fileName,
        mediaType: meta.mediaType,
        fileSize: meta.fileSize,
        paused: false,
        lastPercent: 0,
        lastEditAt: 0,
        editQueue: Promise.resolve(),
      };
      const progressMessage = await ctx.reply(
        renderTaskMessage(task, initialView),
        {
          reply_markup: renderCancelKeyboard(meta.taskId),
        }
      );

      taskViews.set(meta.taskId, {
        ...initialView,
        messageId: progressMessage.message_id,
      });
      logger.debug("已创建任务进度消息", {
        taskId: meta.taskId,
        messageId: progressMessage.message_id,
      });

      const latestTask = getTask(meta.taskId);
      if (latestTask) {
        updateTaskView(latestTask);
      }
    },
    pauseTaskProgress(taskId: string) {
      const view = taskViews.get(taskId);
      if (!view) {
        return;
      }
      view.paused = true;
      logger.debug("暂停任务进度刷新", { taskId });
    },
    resumeTaskProgress(taskId: string) {
      const view = taskViews.get(taskId);
      if (!view) {
        return;
      }
      view.paused = false;
      logger.debug("恢复任务进度刷新", { taskId });
    },
  };
}

export type BotTaskProgressService = ReturnType<
  typeof createBotTaskProgressService
>;
