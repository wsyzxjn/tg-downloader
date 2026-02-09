import type { Message } from "grammy/types";
import { Api } from "telegram";
import { getClient } from "@/client.js";
import { requireSetting } from "@/services/config-service.js";
import { createLogger } from "@/services/logger.js";

let isConnected = false;
let connectPromise: Promise<void> | null = null;
let currentClient: ReturnType<typeof getClient> | null = null;
const logger = createLogger("source-resolver");

function isInvalidPeerError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("CHANNEL_INVALID") ||
    error.message.includes("CHAT_ID_INVALID") ||
    error.message.includes("PEER_ID_INVALID")
  );
}

/**
 * 从 bot token 中解析 bot id。
 * @param botToken Bot API token
 * @returns bot 的数字 id
 */
function parseBotIdFromToken(botToken: string): number {
  const rawId = botToken.split(":")[0];
  const botId = Number.parseInt(rawId, 10);
  if (!Number.isInteger(botId) || botId <= 0) {
    throw new Error("botToken 格式无效，无法解析 bot id");
  }
  return botId;
}

/**
 * 确保用户客户端已连接且已授权。
 * @throws 当用户会话未授权时抛出错误
 */
async function ensureUserClientReady() {
  const client = getClient();
  if (currentClient !== client) {
    currentClient = client;
    isConnected = false;
    connectPromise = null;
  }

  if (!isConnected) {
    if (!connectPromise) {
      connectPromise = (async () => {
        await client.connect();
        isConnected = true;
      })().finally(() => {
        connectPromise = null;
      });
    }
    await connectPromise;
  }

  const isAuthorized = await client.isUserAuthorized();
  if (!isAuthorized) {
    throw new Error("用户客户端未授权，请先完成登录");
  }
}

/**
 * 通过转发来源信息定位源频道消息。
 * @param message bot 收到的消息
 * @returns 源消息；无法定位时返回 null
 */
async function getSourceMessageFromForward(message: Message) {
  const client = getClient();
  const origin = message.forward_origin;
  if (!origin || origin.type !== "channel") {
    return null;
  }

  let sourceMessages: unknown[] = [];
  try {
    sourceMessages = await client.getMessages(origin.chat.id, {
      ids: origin.message_id,
    });
  } catch (error) {
    if (isInvalidPeerError(error)) {
      logger.warn("forward_origin 频道实体无效，回退到 bot 对话查询", {
        chatId: origin.chat.id,
        messageId: origin.message_id,
      });
      return null;
    }
    throw error;
  }

  const sourceMessage = sourceMessages[0];
  if (!sourceMessage || !(sourceMessage instanceof Api.Message)) {
    return null;
  }
  return sourceMessage;
}

/**
 * 在 bot 对话中按消息 id 尝试定位源消息。
 * @param message bot 收到的消息
 * @returns 源消息；无法定位时返回 null
 */
async function getSourceMessageFromBotDialog(message: Message) {
  const client = getClient();
  const botToken = requireSetting().botToken;
  if (!botToken) {
    return null;
  }

  const botId = parseBotIdFromToken(botToken);
  const sourceMessages = await client.getMessages(botId, {
    ids: message.message_id,
  });

  const sourceMessage = sourceMessages[0];
  if (!sourceMessage || !(sourceMessage instanceof Api.Message)) {
    return null;
  }
  return sourceMessage;
}

/**
 * 解析 t.me 消息链接为 peer 与消息 id。
 * @param messageLink Telegram 消息链接
 * @returns 解析结果；链接非法时返回 null
 */
function parseTgMessageLink(messageLink: string) {
  const url = new URL(messageLink);
  if (!["t.me", "telegram.me", "www.t.me"].includes(url.hostname)) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  if (segments[0] === "s" && segments.length >= 3) {
    const username = segments[1];
    const messageId = Number.parseInt(segments[2], 10);
    if (!username || !Number.isInteger(messageId) || messageId <= 0) {
      return null;
    }
    return {
      peer: username,
      messageId,
    };
  }

  if (segments[0] === "c" && segments.length >= 3) {
    const rawChatId = segments[1];
    const rawMessageId = segments[2];
    const messageId = Number.parseInt(rawMessageId, 10);
    if (
      !/^\d+$/.test(rawChatId) ||
      !Number.isInteger(messageId) ||
      messageId <= 0
    ) {
      return null;
    }
    return {
      peer: Number.parseInt(`-100${rawChatId}`, 10),
      messageId,
    };
  }

  const username = segments[0];
  const rawMessageId = segments[1];
  const messageId = Number.parseInt(rawMessageId, 10);
  if (!username || !Number.isInteger(messageId) || messageId <= 0) {
    return null;
  }

  return {
    peer: username,
    messageId,
  };
}

/**
 * 根据 bot 消息定位其源消息。
 * @param message bot 收到的消息
 * @returns 源消息；无法定位时返回 null
 */
export async function resolveSourceMessageFromBotMessage(message: Message) {
  await ensureUserClientReady();
  return (
    (await getSourceMessageFromForward(message)) ??
    (await getSourceMessageFromBotDialog(message))
  );
}

/**
 * 通过 t.me 链接解析并定位源消息。
 * @param messageLink Telegram 消息链接
 * @returns 源消息；无法定位时返回 null
 */
export async function resolveSourceMessageFromLink(messageLink: string) {
  await ensureUserClientReady();
  const client = getClient();
  const parsed = parseTgMessageLink(messageLink);
  if (!parsed) {
    return null;
  }

  const sourceMessages = await client.getMessages(parsed.peer, {
    ids: parsed.messageId,
  });

  const sourceMessage = sourceMessages[0];
  if (!sourceMessage || !(sourceMessage instanceof Api.Message)) {
    return null;
  }

  return sourceMessage;
}
