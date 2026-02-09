import { CommandGroup } from "@grammyjs/commands";
import type { Context } from "grammy";
import { Bot, InlineKeyboard } from "grammy";
import { createAccessControlMiddleware } from "@/middlewares/access-control.js";
import { createLinkDownloadMiddleware } from "@/middlewares/link-download.js";
import { createMediaDownloadMiddleware } from "@/middlewares/media-download.js";
import {
  type BotTaskProgressService,
  createBotTaskProgressService,
} from "@/services/bot-task-progress-service.js";
import { createLogger } from "@/services/logger.js";
import { cancelTask } from "@/services/task-service.js";
import type { Setting } from "@/types/setting.js";
import {
  assignUserLang,
  buildUsageText,
  type Lang,
  normalizeLang,
  resolveUserLang,
} from "./language.js";

const COMMAND_SCOPES: Array<
  | { type: "default" }
  | { type: "all_private_chats" }
  | { type: "all_group_chats" }
  | { type: "all_chat_administrators" }
> = [
  { type: "default" },
  { type: "all_private_chats" },
  { type: "all_group_chats" },
  { type: "all_chat_administrators" },
];

const logger = createLogger("bot");

type CallbackCtx = {
  answerCallbackQuery: (payload: {
    text: string;
    show_alert?: boolean;
  }) => Promise<unknown>;
};

async function answerCallback(
  ctx: CallbackCtx,
  text: string,
  logScope: string,
  showAlert = false
) {
  try {
    await ctx.answerCallbackQuery({
      text,
      show_alert: showAlert,
    });
    return true;
  } catch (error) {
    logger.warn(`${logScope} callback 应答失败`, error);
    return false;
  }
}

function renderCancelKeyboard(taskId: string) {
  return new InlineKeyboard().text("🛑 取消任务", `cancel_task:${taskId}`);
}

function renderCancelConfirmKeyboard(taskId: string, lang: Lang) {
  return new InlineKeyboard()
    .text(
      lang === "en" ? "✅ Confirm cancel" : "✅ 确认取消",
      `cancel_confirm:${taskId}`
    )
    .text(lang === "en" ? "↩️ Back" : "↩️ 返回", `cancel_back:${taskId}`);
}

function registerTaskCallbacks(
  bot: Bot,
  taskProgressService: BotTaskProgressService
) {
  bot.on("callback_query:data", async (ctx, next) => {
    logger.debug("收到 callback", {
      data: ctx.callbackQuery.data,
      fromId: ctx.from?.id,
      chatId: ctx.chat?.id,
      messageId: ctx.callbackQuery.message?.message_id,
    });
    await next();
  });

  bot.callbackQuery(/^cancel_task:(.+)$/, async ctx => {
    const lang = resolveUserLang(ctx);
    const taskId = ctx.match[1];

    try {
      logger.debug("打开取消确认", {
        taskId,
        userId: ctx.from?.id,
      });
      taskProgressService.pauseTaskProgress(taskId);
      await answerCallback(
        ctx,
        lang === "en" ? "Please confirm cancellation." : "请确认是否取消任务。",
        "cancel_task"
      );
      await ctx.editMessageReplyMarkup({
        reply_markup: renderCancelConfirmKeyboard(taskId, lang),
      });
    } catch (error) {
      taskProgressService.resumeTaskProgress(taskId);
      await answerCallback(
        ctx,
        error instanceof Error
          ? error.message
          : lang === "en"
            ? "Failed to open cancel confirmation."
            : "打开取消确认失败。",
        "cancel_task",
        true
      );
    }
  });

  bot.callbackQuery(/^cancel_back:(.+)$/, async ctx => {
    const lang = resolveUserLang(ctx);
    const taskId = ctx.match[1];

    try {
      logger.debug("恢复取消按钮", {
        taskId,
        userId: ctx.from?.id,
      });
      taskProgressService.resumeTaskProgress(taskId);
      await answerCallback(
        ctx,
        lang === "en" ? "Canceled operation." : "已返回。",
        "cancel_back"
      );
      await ctx.editMessageReplyMarkup({
        reply_markup: renderCancelKeyboard(taskId),
      });
    } catch (error) {
      taskProgressService.resumeTaskProgress(taskId);
      await answerCallback(
        ctx,
        error instanceof Error
          ? error.message
          : lang === "en"
            ? "Failed to restore cancel button."
            : "恢复取消按钮失败。",
        "cancel_back",
        true
      );
    }
  });

  bot.callbackQuery(/^cancel_confirm:(.+)$/, async ctx => {
    const lang = resolveUserLang(ctx);
    const taskId = ctx.match[1];
    let callbackAnswered = false;

    try {
      logger.debug("执行取消任务", {
        taskId,
        userId: ctx.from?.id,
      });
      taskProgressService.pauseTaskProgress(taskId);
      callbackAnswered = await answerCallback(
        ctx,
        lang === "en" ? "Cancelling..." : "正在取消任务...",
        "cancel_confirm"
      );
      cancelTask(taskId);
    } catch (error) {
      taskProgressService.resumeTaskProgress(taskId);
      logger.warn("取消任务失败", {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!callbackAnswered) {
        await answerCallback(
          ctx,
          error instanceof Error
            ? error.message
            : lang === "en"
              ? "Failed to cancel task."
              : "取消任务失败。",
          "cancel_confirm",
          true
        );
        return;
      }

      await ctx.reply(
        lang === "en" ? "❌ Failed to cancel task." : "❌ 取消任务失败。"
      );
    }
  });
}

function registerCommands(
  bot: Bot,
  commands: CommandGroup<Context>,
  syncCommands: () => Promise<void>
) {
  commands
    .command("start", "查看机器人使用说明")
    .addToScope({ type: "default" }, async ctx => {
      const lang = resolveUserLang(ctx);
      await ctx.reply(buildUsageText(lang));
    });

  commands
    .command("help", "查看下载与使用帮助")
    .addToScope({ type: "default" }, async ctx => {
      const lang = resolveUserLang(ctx);
      await ctx.reply(buildUsageText(lang));
    });

  commands
    .command("lang", "切换语言（zh/en）")
    .addToScope({ type: "default" }, async ctx => {
      const lang = resolveUserLang(ctx);
      const rawText = ctx.msg?.text ?? "";
      const [, arg] = rawText.split(/\s+/, 2);
      const nextLang = normalizeLang(arg);

      if (!ctx.from?.id) {
        await ctx.reply(
          lang === "en"
            ? "Unable to detect user ID for language setting."
            : "无法识别用户，语言设置失败。"
        );
        return;
      }

      if (!nextLang) {
        const currentLangText = lang === "en" ? "English" : "中文";
        await ctx.reply(
          lang === "en"
            ? `Usage: /lang <zh|en>\nCurrent language: ${currentLangText}`
            : `用法：/lang <zh|en>\n当前语言：${currentLangText}`
        );
        return;
      }

      assignUserLang(ctx.from.id, nextLang);
      await ctx.reply(
        nextLang === "en"
          ? "✅ Language switched to English."
          : "✅ 已切换为中文。"
      );
    });

  commands
    .command("sync_commands", "立即同步命令提示列表")
    .addToScope({ type: "default" }, async ctx => {
      const lang = resolveUserLang(ctx);
      await ctx.reply(
        lang === "en"
          ? "🔄 Syncing command suggestions..."
          : "🔄 正在同步命令提示列表..."
      );
      try {
        await syncCommands();
        await ctx.reply(
          lang === "en"
            ? "✅ Command suggestions synchronized."
            : "✅ 命令提示列表已同步"
        );
      } catch (error) {
        await ctx.reply(
          lang === "en"
            ? "❌ Failed to sync command suggestions."
            : "❌ 命令提示列表同步失败，请稍后重试"
        );
        logger.warn("手动同步 Bot 命令提示失败", error);
      }
    });

  bot.use(commands);
}

export function createBotInstance(setting: Setting) {
  const bot = new Bot(setting.botToken!);
  const commands = new CommandGroup();
  const taskProgressService = createBotTaskProgressService();
  taskProgressService.start();

  const clearCommandScopes = async () => {
    await Promise.allSettled(
      COMMAND_SCOPES.map(scope => bot.api.deleteMyCommands({ scope }))
    );
  };

  const syncCommands = async () => {
    await clearCommandScopes();
    await commands.setCommands(bot);
  };

  bot.use(createAccessControlMiddleware());
  registerTaskCallbacks(bot, taskProgressService);
  registerCommands(bot, commands, syncCommands);

  bot.use(
    createMediaDownloadMiddleware({
      trackTaskProgress: taskProgressService.trackTaskProgress,
    })
  );

  bot.use(
    createLinkDownloadMiddleware({
      trackTaskProgress: taskProgressService.trackTaskProgress,
    })
  );

  return {
    bot,
    syncCommands,
    taskProgressService,
  };
}
