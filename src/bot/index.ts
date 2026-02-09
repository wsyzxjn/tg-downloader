import { MEDIA_TYPES } from "@/constants/media-types.js";
import {
  getSetting,
  type Setting,
  subscribeSettingChanges,
} from "@/services/config-service.js";
import { createLogger } from "@/services/logger.js";
import { cancelActiveBotSourceTasks } from "@/services/task-service.js";
import { createBotInstance } from "./create-bot-instance.js";

const logger = createLogger("bot");
let activeBot: ReturnType<typeof createBotInstance>["bot"] | null = null;
let activeBotToken: string | null = null;
let activeBotTaskProgressService:
  | ReturnType<typeof createBotInstance>["taskProgressService"]
  | null = null;
let applyingBotConfig: Promise<void> | null = null;

function validateMediaTypes(setting: Setting) {
  const { mediaTypes } = setting;
  for (const mediaType of mediaTypes) {
    if (!MEDIA_TYPES.includes(mediaType)) {
      throw new Error(`不支持的媒体类型: ${mediaType}`);
    }
  }
}

async function stopActiveBot() {
  if (!activeBot) {
    return;
  }

  try {
    activeBot.stop();
  } catch (error) {
    logger.warn("停止 Bot 失败", error);
  }

  const canceledCount = cancelActiveBotSourceTasks();
  if (canceledCount > 0) {
    logger.info("Bot 停止时已取消活动下载任务", { canceledCount });
  }

  activeBot = null;
  activeBotToken = null;
  if (activeBotTaskProgressService) {
    activeBotTaskProgressService.stop();
    activeBotTaskProgressService = null;
  }
}

async function applyBotConfig() {
  const setting = getSetting();

  if (!setting) {
    await stopActiveBot();
    logger.warn("配置未初始化，Bot 未启动。请先通过前端完成配置初始化。");
    return;
  }

  if (!setting.botToken) {
    await stopActiveBot();
    logger.warn("配置中未设置 botToken，Bot 未启动。");
    return;
  }

  validateMediaTypes(setting);

  if (activeBot && activeBotToken === setting.botToken) {
    return;
  }

  await stopActiveBot();

  const { bot, syncCommands, taskProgressService } = createBotInstance(setting);
  activeBot = bot;
  activeBotToken = setting.botToken;
  activeBotTaskProgressService = taskProgressService;

  try {
    await syncCommands();
    logger.info("已自动同步 Bot 命令提示");
  } catch (error) {
    logger.warn("自动同步 Bot 命令提示失败", error);
  }

  void bot.start().catch(error => {
    if (activeBot === bot) {
      activeBot = null;
      activeBotToken = null;
    }
    logger.error("Bot 运行异常，已停止", error);
  });
}

function scheduleApplyBotConfig() {
  if (applyingBotConfig) {
    return applyingBotConfig;
  }

  applyingBotConfig = applyBotConfig().finally(() => {
    applyingBotConfig = null;
  });

  return applyingBotConfig;
}

void scheduleApplyBotConfig();
subscribeSettingChanges(() => {
  void scheduleApplyBotConfig();
});
