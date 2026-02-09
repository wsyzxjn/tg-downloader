import { Api, TelegramClient } from "telegram";
import type { TelegramClientParams } from "telegram/client/telegramBaseClient.js";
import type { SocksProxyType } from "telegram/network/connection/TCPMTProxy.js";
import { StringSession } from "telegram/sessions/StringSession.js";

interface ApiCredentialsInput {
  apiId: number;
  apiHash: string;
  proxy?: string;
}

interface SendCodeInput extends ApiCredentialsInput {
  phoneNumber: string;
}

interface VerifyCodeInput extends ApiCredentialsInput {
  phoneNumber: string;
  phoneCode: string;
  password?: string;
}

interface PendingPhoneCode {
  phoneCodeHash: string;
  expiresAt: number;
  session: string;
}

const PHONE_CODE_TTL_MS = 10 * 60 * 1000;
const PROXY_TEST_TIMEOUT_MS = 12_000;
const pendingPhoneCodes = new Map<string, PendingPhoneCode>();

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    operation
      .then(resolve)
      .catch(reject)
      .finally(() => {
        clearTimeout(timer);
      });
  });
}

function parseProxy(proxy: string | undefined): SocksProxyType | undefined {
  if (!proxy) {
    return undefined;
  }

  try {
    const proxyUrl = new URL(proxy);
    if (proxyUrl.protocol === "socks5:" || proxyUrl.protocol === "socks4:") {
      return {
        ip: proxyUrl.hostname,
        port: Number.parseInt(proxyUrl.port, 10),
        socksType: proxyUrl.protocol === "socks5:" ? 5 : 4,
        username: proxyUrl.username || undefined,
        password: proxyUrl.password || undefined,
        timeout: 10,
      };
    }
  } catch (error) {
    console.error("代理 URL 格式错误:", proxy, error);
  }

  return undefined;
}

function createAuthClient(input: ApiCredentialsInput, session = "") {
  const stringSession = new StringSession(session);
  const clientParams: TelegramClientParams = {
    connectionRetries: 3,
    proxy: parseProxy(input.proxy),
  };

  const client = new TelegramClient(
    stringSession,
    input.apiId,
    input.apiHash,
    clientParams
  );
  return {
    client,
    stringSession,
  };
}

function getPendingPhoneCode(phoneNumber: string) {
  const pending = pendingPhoneCodes.get(phoneNumber);
  if (!pending) {
    return null;
  }

  if (pending.expiresAt < Date.now()) {
    pendingPhoneCodes.delete(phoneNumber);
    return null;
  }

  return pending;
}

/**
 * 发送 Telegram 登录验证码。
 * @param input 登录参数
 * @returns 发送结果
 */
export async function sendTelegramLoginCode(input: SendCodeInput) {
  const { client, stringSession } = createAuthClient(input);
  try {
    await client.connect();
    const result = await client.sendCode(
      {
        apiId: input.apiId,
        apiHash: input.apiHash,
      },
      input.phoneNumber
    );

    pendingPhoneCodes.set(input.phoneNumber, {
      phoneCodeHash: result.phoneCodeHash,
      expiresAt: Date.now() + PHONE_CODE_TTL_MS,
      session: stringSession.save(),
    });

    return {
      isCodeViaApp: result.isCodeViaApp,
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * 校验 Telegram 登录验证码并返回 session。
 * @param input 登录参数
 * @returns 登录结果
 */
export async function verifyTelegramLoginCode(input: VerifyCodeInput) {
  const pending = getPendingPhoneCode(input.phoneNumber);
  if (!pending) {
    throw new Error("验证码会话不存在或已过期，请重新发送验证码");
  }

  const { client } = createAuthClient(input, pending.session);
  try {
    await client.connect();
    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: input.phoneNumber,
          phoneCodeHash: pending.phoneCodeHash,
          phoneCode: input.phoneCode,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("SESSION_PASSWORD_NEEDED")) {
        if (!input.password) {
          return {
            needPassword: true,
          } as const;
        }
        await client.signInWithPassword(
          {
            apiId: input.apiId,
            apiHash: input.apiHash,
          },
          {
            password: async () => input.password!,
            onError: async () => false,
          }
        );
      } else if (message.includes("PHONE_CODE_EXPIRED")) {
        pendingPhoneCodes.delete(input.phoneNumber);
        throw new Error("验证码已过期，请重新发送验证码");
      } else if (message.includes("PHONE_CODE_INVALID")) {
        throw new Error("验证码错误，请检查后重试");
      } else {
        throw error;
      }
    }

    const me = await client.getMe();
    const session = client.session.save();
    pendingPhoneCodes.delete(input.phoneNumber);
    return {
      needPassword: false,
      session,
      userId: Number(me.id),
      firstName: me.firstName || "",
      username: me.username || "",
    } as const;
  } finally {
    await client.disconnect();
  }
}

/**
 * 测试 Telegram API 连接（可选经过 socks 代理）。
 * @param input API 凭证与可选代理地址
 */
export async function testTelegramProxyConnection(input: ApiCredentialsInput) {
  const { client } = createAuthClient(input);
  try {
    await withTimeout(
      (async () => {
        await client.connect();
        await client.invoke(new Api.help.GetConfig());
      })(),
      PROXY_TEST_TIMEOUT_MS,
      `代理连接测试超时（>${Math.floor(PROXY_TEST_TIMEOUT_MS / 1000)} 秒）`
    );
    return {
      ok: true as const,
    };
  } finally {
    await client.disconnect();
  }
}
