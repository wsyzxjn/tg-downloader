# AGENTS.md

## 项目概览
- 项目名: `tg-download-bot`
- 目标: 通过 Telegram Bot + User API 下载媒体文件，提供 Bot 交互和 Web 控制台。
- 运行环境: Node.js `>=20`, pnpm `10`.

## 目录结构
- `src/`: 后端与 Bot 主体
- `src/api/`: Hono API（配置、任务、认证、SSE）
- `src/bot/`: Bot 启动与装配（生命周期、命令/回调注册、语言）
- `src/services/`: 核心业务（配置读取、配置写入管理、任务、下载、来源解析、认证）
- `src/middlewares/`: Bot 中间件（鉴权、附件下载、链接下载）
- `web/`: React + Vite 前端控制台
- `web/src/components/app/`: 页面级组件（导航、任务页、设置页、初始化页）
- `web/src/hooks/`: 前端流程编排（初始化、任务、SSE/轮询等）

## 关键行为约定
- 下载能力:
  - 支持单消息文件下载。
  - 支持媒体组（album）一次下载全部可下载文件（按 `groupedId` 聚合）。
- 任务模型:
  - 单任务可包含多文件结果。
  - `result.filePath/fileName` 保持兼容（首文件/摘要）。
  - 多文件字段使用 `result.filePaths/fileNames`。
- 任务进度:
  - Web 端优先使用 SSE (`/api/tasks/stream`)。
  - SSE 断开时前端自动重连，并触发一次全量任务拉取兜底。
- Bot 进度:
  - 由任务事件驱动（`task-service` 发布事件，`bot-task-progress-service` 订阅并更新消息）。
  - 进度行格式为“进度条 + 百分比”同一行（`📊 [████░░░░░░] 35%`）。
  - 取消确认阶段会暂停该任务的进度消息刷新，避免确认按钮被覆盖。
- 任务取消:
  - 支持 Web API 取消与 Bot 内联按钮取消。
  - Bot 侧为二次确认流程：`取消任务 -> 确认取消/返回`。
  - 取消后任务状态保持为 `canceled`，不会被后续下载异常覆盖成 `failed`。
  - 若任务由 Bot 发起，Web 端取消时也会触发删除 Bot 进度消息（由事件订阅方统一处理）。
- Bot 回调处理:
  - 下载流程在中间件中异步启动，不阻塞当前 update，避免 callback query 因超时失效。
  - callback query 相关路径使用安全应答（应答失败会记录日志，不阻断主流程）。
- Bot 重启恢复:
  - Bot 停止/重启时会取消来源为 `bot_message:*` 的活动任务，避免出现无绑定进度消息的悬挂任务。
- 日志:
  - 使用 `LOG_LEVEL` 控制日志级别（`debug|info|warn|error`，默认 `error`）。
  - 任务状态流转与 Bot 回调排障信息建议仅在 `LOG_LEVEL=debug` 下开启。

## 开发命令

### 后端（根目录）
- 开发: `pnpm run dev`
- 构建: `pnpm run build`
- 启动构建产物: `pnpm run start`
- 类型检查: `pnpm run type-check`
- 代码检查: `pnpm run check`
- 格式化: `pnpm run format`
- 说明: 根目录 `check` 当前只校验后端 `src`（`biome check src`）。

### 前端（web）
- 开发: `pnpm -C web run dev`
- 构建: `pnpm -C web run build`
- Lint: `pnpm -C web run lint`

## 代码规范
- 后端:
  - 使用 Biome 规则，提交前至少通过 `pnpm run check` 与 `pnpm run type-check`。
  - 服务层优先承载业务逻辑，中间件与 API 层尽量做编排。
- 前端:
  - 路由使用 `react-router-dom`，当前页面为 `/init`、`/tasks`、`/settings`。
  - 组件负责展示，复杂状态与副作用优先放在 hooks。
  - 提交前至少通过 `pnpm -C web run lint` 与 `pnpm -C web run build`。

## 变更建议
- 新增下载能力时，优先修改 `src/services/media-downloader.ts`，并保持任务结果字段兼容。
- 新增任务状态或事件时，同步更新:
  - `src/services/task-service.ts`
  - `src/api/app.ts`（SSE 推送结构）
  - `web/src/types/app.ts`
  - `web/src/hooks/use-task-actions.ts` / `web/src/hooks/use-app-effects.ts`
- 新增/调整取消任务行为时，同步检查:
  - `src/services/task-service.ts`（`cancelTask` 与状态流转）
  - `src/services/bot-task-progress-service.ts`（进度消息刷新、暂停与删除）
  - `src/bot/create-bot-instance.ts`（回调按钮与二次确认）
- 新增/调整配置初始化或更新行为时，同步检查:
  - `src/services/setting-management-service.ts`（配置校验与持久化写入）
  - `src/services/config-service.ts`（配置读取缓存与变更通知）
  - `src/api/app.ts`（配置 API 入参与响应）
- 改动 UI 时，避免破坏初始化流程与任务页/设置页路由分离。
