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
    error.message.includes("Could not find the input entity for") ||
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

  const username =
    "username" in origin.chat &&
    typeof origin.chat.username === "string" &&
    origin.chat.username.trim()
      ? origin.chat.username.trim()
      : null;

  const peerCandidates: Array<string | number> = [];
  if (username) {
    peerCandidates.push(username);
  }
  peerCandidates.push(origin.chat.id);

  for (const peer of peerCandidates) {
    try {
      const sourceMessages = await client.getMessages(peer, {
        ids: origin.message_id,
      });
      const sourceMessage = sourceMessages[0];
      if (sourceMessage && sourceMessage instanceof Api.Message) {
        return sourceMessage;
      }
    } catch (error) {
      if (!isInvalidPeerError(error)) {
        throw error;
      }

      if (typeof peer === "number") {
        try {
          // Warm up entity cache and retry once for numeric channel id peers.
          await client.getDialogs({ limit: 200 });
          const sourceMessages = await client.getMessages(peer, {
            ids: origin.message_id,
          });
          const sourceMessage = sourceMessages[0];
          if (sourceMessage && sourceMessage instanceof Api.Message) {
            return sourceMessage;
          }
        } catch (retryError) {
          if (!isInvalidPeerError(retryError)) {
            throw retryError;
          }
        }
      }
    }
  }

  logger.warn("forward_origin 源消息解析失败，回退到 bot 对话查询", {
    chatId: origin.chat.id,
    messageId: origin.message_id,
    username,
  });
  return null;
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
  let sourceMessages: unknown[] = [];
  try {
    sourceMessages = await client.getMessages(botId, {
      ids: message.message_id,
    });
  } catch (error) {
    if (!isInvalidPeerError(error)) {
      throw error;
    }

    // The bot peer may not be cached yet for this user session.
    await client.getDialogs({ limit: 200 });
    sourceMessages = await client.getMessages(botId, {
      ids: message.message_id,
    });
  }

  const sourceMessage = sourceMessages[0];
  if (!sourceMessage || !(sourceMessage instanceof Api.Message)) {
    return null;
  }
  return sourceMessage;
}

export async function resolveSourceMessageFromBotMessage(message: Message) {
  await ensureUserClientReady();
  return (
    (await getSourceMessageFromForward(message)) ??
    (await getSourceMessageFromBotDialog(message))
  );
}
