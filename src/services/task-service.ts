import { randomUUID } from "node:crypto";
import type { Message } from "grammy/types";
import { requireSetting } from "@/services/config-service.js";
import type { FileInfo } from "@/services/file-info-service.js";
import { createLogger } from "@/services/logger.js";
import {
  type DownloadProgress,
  downloadFile,
  downloadFileByMessageLink,
} from "@/services/media-downloader.js";
import type { MediaType } from "@/types/setting.js";

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "canceled";
export type TaskType = "link_download" | "bot_message_download";
export type TaskProgress = DownloadProgress;

export interface TaskResult {
  filePath?: string;
  fileName?: string;
  filePaths?: string[];
  fileNames?: string[];
  error?: string;
}

interface TaskMeta {
  messageLink?: string;
  sourceKey?: string;
  fileName?: string;
  fileSize?: number;
  mediaType?: MediaType;
}

export interface TaskRecord {
  id: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  progress: TaskProgress;
  meta?: TaskMeta;
  result?: TaskResult;
}

interface LinkTaskPayload {
  type: "link_download";
  messageLink: string;
  sourceKey?: string;
}

interface BotMessageTaskPayload {
  type: "bot_message_download";
  message: Message;
  fileInfo: FileInfo;
}

type TaskPayload = LinkTaskPayload | BotMessageTaskPayload;
type TaskEventType = "upsert" | "remove";

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  task?: TaskRecord;
}

const tasks = new Map<string, TaskRecord>();
const taskPayloads = new Map<string, TaskPayload>();
const taskEventListeners = new Set<(event: TaskEvent) => void>();
const TASK_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_CONCURRENT_RUNNING_TASKS = 3;
const runningTaskIds = new Set<string>();
const logger = createLogger("task-service");

function normalizeTaskErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (
    raw.includes("Could not find the input entity for") ||
    raw.includes("PEER_ID_INVALID") ||
    raw.includes("CHANNEL_INVALID") ||
    raw.includes("CHAT_ID_INVALID")
  ) {
    return "无法定位消息来源实体，请确认当前账号已加入来源频道/群组并且有访问权限。";
  }

  if (raw.includes("MESSAGE_ID_INVALID")) {
    return "消息 ID 无效，可能该消息已删除或当前账号无权访问。";
  }

  if (
    raw.includes("AUTH_KEY_UNREGISTERED") ||
    raw.includes("SESSION_REVOKED")
  ) {
    return "用户会话已失效，请重新完成 Telegram 登录。";
  }

  if (raw.includes("FLOOD_WAIT")) {
    return "请求过于频繁，Telegram 触发限流，请稍后重试。";
  }

  return raw || "未知错误";
}

function getExpiresAt(): string {
  return new Date(Date.now() + TASK_TTL_MS).toISOString();
}

function isTaskFinished(status: TaskStatus): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}

function cleanupExpiredTasks() {
  const now = Date.now();
  for (const [taskId, task] of tasks) {
    if (!task.expiresAt) {
      continue;
    }
    if (!isTaskFinished(task.status)) {
      continue;
    }
    if (new Date(task.expiresAt).getTime() <= now) {
      tasks.delete(taskId);
      taskPayloads.delete(taskId);
      emitTaskEvent({
        type: "remove",
        taskId,
      });
    }
  }
}

const cleanupTimer = setInterval(cleanupExpiredTasks, 60_000);
cleanupTimer.unref();

function logTaskDebug(taskId: string, message: string, extra?: unknown) {
  if (extra !== undefined) {
    logger.debug(`[task:${taskId}] ${message}`, extra);
    return;
  }
  logger.debug(`[task:${taskId}] ${message}`);
}

function cloneTask(task: TaskRecord): TaskRecord {
  return {
    ...task,
    progress: {
      ...task.progress,
    },
    meta: task.meta
      ? {
          ...task.meta,
        }
      : undefined,
    result: task.result
      ? {
          ...task.result,
          filePaths: task.result.filePaths
            ? [...task.result.filePaths]
            : undefined,
          fileNames: task.result.fileNames
            ? [...task.result.fileNames]
            : undefined,
        }
      : undefined,
  };
}

function emitTaskEvent(event: TaskEvent) {
  for (const listener of taskEventListeners) {
    listener(event);
  }
}

function emitTaskUpsert(task: TaskRecord) {
  emitTaskEvent({
    type: "upsert",
    taskId: task.id,
    task: cloneTask(task),
  });
}

export function subscribeTaskEvents(listener: (event: TaskEvent) => void) {
  taskEventListeners.add(listener);
  return () => {
    taskEventListeners.delete(listener);
  };
}

function findNextPendingTaskId(): string | null {
  const candidates = [...tasks.values()]
    .filter(task => task.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const task of candidates) {
    if (runningTaskIds.has(task.id)) {
      continue;
    }
    if (!taskPayloads.has(task.id)) {
      continue;
    }
    return task.id;
  }

  return null;
}

function scheduleTaskRuns() {
  while (runningTaskIds.size < MAX_CONCURRENT_RUNNING_TASKS) {
    const nextTaskId = findNextPendingTaskId();
    if (!nextTaskId) {
      return;
    }

    runningTaskIds.add(nextTaskId);
    void runTask(nextTaskId).finally(() => {
      runningTaskIds.delete(nextTaskId);
      scheduleTaskRuns();
    });
  }
}

interface CreateLinkTaskOptions {
  sourceKey?: string;
}

/**
 * 创建并启动链接下载任务。
 * @param messageLink Telegram 消息链接
 * @param options 任务附加参数
 * @returns 新建任务
 */
export function createLinkDownloadTask(
  messageLink: string,
  options?: CreateLinkTaskOptions
): TaskRecord {
  const taskId = randomUUID();
  const now = new Date().toISOString();
  const task: TaskRecord = {
    id: taskId,
    type: "link_download",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    progress: {
      downloaded: 0,
      total: 0,
      percent: 0,
    },
    meta: {
      messageLink,
      sourceKey: options?.sourceKey,
    },
  };

  tasks.set(task.id, task);
  emitTaskUpsert(task);
  taskPayloads.set(taskId, {
    type: "link_download",
    messageLink,
    sourceKey: options?.sourceKey,
  });
  scheduleTaskRuns();
  return task;
}

/**
 * 创建并启动 bot 消息下载任务。
 * @param message bot 消息对象
 * @param fileInfo 文件信息
 * @returns 新建任务
 */
export function createBotMessageDownloadTask(
  message: Message,
  fileInfo: FileInfo,
  sourceKey?: string
): TaskRecord {
  const taskId = randomUUID();
  const now = new Date().toISOString();
  const task: TaskRecord = {
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
    meta: {
      fileName: fileInfo.fileName,
      fileSize: fileInfo.fileSize,
      mediaType: fileInfo.mediaType,
      sourceKey,
    },
  };

  tasks.set(task.id, task);
  emitTaskUpsert(task);
  taskPayloads.set(taskId, {
    type: "bot_message_download",
    message,
    fileInfo,
  });
  scheduleTaskRuns();
  return task;
}

/**
 * 获取任务详情。
 * @param taskId 任务 ID
 * @returns 任务记录
 */
export function getTask(taskId: string): TaskRecord | undefined {
  cleanupExpiredTasks();
  return tasks.get(taskId);
}

/**
 * 列出任务，按创建时间倒序返回。
 * @returns 任务列表
 */
export function listTasks(): TaskRecord[] {
  cleanupExpiredTasks();
  return [...tasks.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * 取消任务。
 * @param taskId 任务 ID
 * @returns 取消后的任务
 */
export function cancelTask(taskId: string, reason = "任务已取消"): TaskRecord {
  cleanupExpiredTasks();
  const task = tasks.get(taskId);
  if (!task) {
    logTaskDebug(taskId, "cancel rejected: task not found");
    throw new Error("任务不存在");
  }

  if (task.status === "completed" || task.status === "failed") {
    logTaskDebug(taskId, "cancel rejected: task already finished", {
      status: task.status,
    });
    throw new Error("任务已结束，无法取消");
  }

  if (task.status === "canceled") {
    logTaskDebug(taskId, "cancel ignored: task already canceled");
    return task;
  }

  const fromStatus = task.status;
  logTaskDebug(taskId, "cancel accepted", { fromStatus });
  task.status = "canceled";
  task.updatedAt = new Date().toISOString();
  task.result = {
    ...(task.result || {}),
    error: reason,
  };
  if (fromStatus === "pending") {
    taskPayloads.delete(taskId);
    scheduleTaskRuns();
  }
  task.expiresAt = getExpiresAt();
  emitTaskUpsert(task);
  return task;
}

export function cancelActiveBotSourceTasks(
  reason = "Bot 重启，任务已取消"
): number {
  cleanupExpiredTasks();
  let canceledCount = 0;
  for (const task of tasks.values()) {
    if (task.status !== "pending" && task.status !== "running") {
      continue;
    }
    if (!task.meta?.sourceKey?.startsWith("bot_message:")) {
      continue;
    }
    cancelTask(task.id, reason);
    canceledCount += 1;
  }
  if (canceledCount > 0) {
    logger.info("已取消 Bot 来源的活动任务", { canceledCount });
  }
  return canceledCount;
}

/**
 * 根据来源键查找进行中的任务。
 * @param sourceKey 来源键（通常由 chatId + messageId 组成）
 * @returns 进行中的任务，未找到返回 undefined
 */
export function findActiveTaskBySourceKey(
  sourceKey: string
): TaskRecord | undefined {
  cleanupExpiredTasks();
  for (const task of tasks.values()) {
    if (task.status !== "running" && task.status !== "pending") {
      continue;
    }
    if (task.meta?.sourceKey === sourceKey) {
      return task;
    }
  }
  return undefined;
}

async function runTask(taskId: string) {
  const task = tasks.get(taskId);
  const payload = taskPayloads.get(taskId);
  if (!task) {
    logTaskDebug(taskId, "run skipped: task not found");
    return;
  }
  if (!payload) {
    logTaskDebug(taskId, "run failed: payload missing");
    task.updatedAt = new Date().toISOString();
    if (task.status === "canceled") {
      task.expiresAt = getExpiresAt();
      emitTaskUpsert(task);
      return;
    }

    task.status = "failed";
    task.result = {
      error: "任务参数丢失",
    };
    task.expiresAt = getExpiresAt();
    emitTaskUpsert(task);
    return;
  }

  if (task.status === "canceled") {
    logTaskDebug(taskId, "run skipped: task already canceled before start");
    task.updatedAt = new Date().toISOString();
    task.expiresAt = getExpiresAt();
    emitTaskUpsert(task);
    return;
  }

  task.status = "running";
  logTaskDebug(taskId, "status -> running");
  task.updatedAt = new Date().toISOString();
  emitTaskUpsert(task);

  try {
    const setting = requireSetting();
    const progressHandler = (progress: TaskProgress) => {
      const currentTask = tasks.get(taskId);
      if (!currentTask) {
        return;
      }

      if (currentTask.status === "canceled") {
        logTaskDebug(taskId, "progress ignored: task already canceled");
        throw new Error("任务已取消");
      }

      currentTask.progress = progress;
      currentTask.updatedAt = new Date().toISOString();
      emitTaskUpsert(currentTask);
    };

    const downloadResult =
      payload.type === "link_download"
        ? await downloadFileByMessageLink(
            payload.messageLink,
            setting.downloadDir,
            {
              allowedMediaTypes: setting.mediaTypes,
              albumConcurrency: setting.downloadFileConcurrency,
              onProgress: progressHandler,
            }
          )
        : await downloadFile(
            payload.message,
            payload.fileInfo,
            setting.downloadDir,
            {
              albumConcurrency: setting.downloadFileConcurrency,
              onProgress: progressHandler,
            }
          );

    const currentTask = tasks.get(taskId);
    if (!currentTask) {
      return;
    }

    if (currentTask.status === "canceled") {
      logTaskDebug(taskId, "download finished after cancel; keep canceled");
      currentTask.updatedAt = new Date().toISOString();
      currentTask.expiresAt = getExpiresAt();
      emitTaskUpsert(currentTask);
      return;
    }

    currentTask.status = "completed";
    logTaskDebug(taskId, "status -> completed");
    currentTask.updatedAt = new Date().toISOString();
    currentTask.progress = {
      ...currentTask.progress,
      percent: 100,
    };
    currentTask.result = {
      filePath: downloadResult.filePaths[0],
      fileName:
        downloadResult.fileInfos.length === 1
          ? downloadResult.fileInfos[0]?.fileName
          : `共 ${downloadResult.fileInfos.length} 个文件`,
      filePaths: downloadResult.filePaths,
      fileNames: downloadResult.fileInfos
        .map(fileInfo => fileInfo.fileName)
        .filter((name): name is string => Boolean(name)),
    };
    currentTask.expiresAt = getExpiresAt();
    emitTaskUpsert(currentTask);
  } catch (error) {
    const currentTask = tasks.get(taskId);
    if (!currentTask) {
      logTaskDebug(taskId, "run catch ignored: task removed");
      return;
    }

    if (currentTask.status === "canceled") {
      logTaskDebug(taskId, "run catch after cancel; keep canceled", {
        error: error instanceof Error ? error.message : String(error),
      });
      currentTask.updatedAt = new Date().toISOString();
      currentTask.expiresAt = getExpiresAt();
      emitTaskUpsert(currentTask);
      return;
    }

    currentTask.status = "failed";
    const normalizedMessage = normalizeTaskErrorMessage(error);
    logTaskDebug(taskId, "status -> failed", {
      error: normalizedMessage,
    });
    currentTask.updatedAt = new Date().toISOString();
    currentTask.result = {
      error: normalizedMessage,
    };
    currentTask.expiresAt = getExpiresAt();
    emitTaskUpsert(currentTask);
  } finally {
    taskPayloads.delete(taskId);
  }
}
