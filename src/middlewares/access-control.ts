import type { Context, MiddlewareFn } from "grammy";
import { getSetting } from "@/services/config-service.js";
import { createLogger } from "@/services/logger.js";

const logger = createLogger("middleware-access-control");

/**
 * 创建访问控制中间件。
 * 用于校验消息发送者是否在允许列表中。
 * @returns grammy 中间件函数
 */
export function createAccessControlMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const deny = async (text: string) => {
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({
            text,
            show_alert: true,
          });
        } catch (error) {
          logger.warn("callbackQuery 应答失败", error);
        }
        return;
      }
      await ctx.reply(text);
    };

    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }

    try {
      const setting = getSetting();
      if (!setting) {
        await deny("❌ 配置尚未初始化");
        return;
      }

      const allowed = setting.allowedUserIds.includes(userId);
      if (!allowed) {
        await deny("⛔ 你没有权限使用该功能");
        return;
      }
    } catch (error) {
      logger.error("权限校验失败", error);
      await deny("❌ 权限校验失败，请检查用户配置或登录状态");
      return;
    }

    await next();
  };
}
