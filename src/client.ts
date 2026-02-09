import { TelegramClient } from "telegram";
import type { TelegramClientParams } from "telegram/client/telegramBaseClient.js";
import type { SocksProxyType } from "telegram/network/connection/TCPMTProxy.js";
import { StringSession } from "telegram/sessions/StringSession.js";
import { requireSetting } from "./services/config-service.js";

let clientInstance: TelegramClient | null = null;
let clientConfigKey = "";

/**
 * 构造用于比较客户端配置变化的 key。
 * @returns 配置 key
 */
function buildClientConfigKey() {
  const setting = requireSetting();
  return JSON.stringify({
    apiId: setting.apiId,
    apiHash: setting.apiHash,
    session: setting.session || "",
    proxy: setting.proxy || "",
  });
}

/**
 * 根据配置解析 socks 代理。
 * @returns socks 代理配置
 */
function parseProxy(): SocksProxyType | undefined {
  const setting = requireSetting();
  if (!setting.proxy) {
    return undefined;
  }

  try {
    const proxyUrl = new URL(setting.proxy);
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

    console.warn(`不支持的代理协议: ${proxyUrl.protocol},仅支持 socks4/socks5`);
  } catch (e) {
    console.error("代理 URL 格式错误:", setting.proxy, e);
  }

  return undefined;
}

function createClient() {
  const setting = requireSetting();
  const session = new StringSession(setting.session || "");
  const clientParams: TelegramClientParams = {
    connectionRetries: 5,
    proxy: parseProxy(),
  };

  return new TelegramClient(
    session,
    setting.apiId,
    setting.apiHash,
    clientParams
  );
}

/**
 * 获取当前配置对应的 Telegram 客户端实例。
 * @returns Telegram 客户端
 */
export function getClient(): TelegramClient {
  const nextKey = buildClientConfigKey();
  if (!clientInstance || clientConfigKey !== nextKey) {
    if (clientInstance) {
      void clientInstance.disconnect();
    }
    clientInstance = createClient();
    clientConfigKey = nextKey;
  }

  return clientInstance;
}
