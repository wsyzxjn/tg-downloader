# AGENTS.md

## 项目概览
- 项目名: `tg-downloader`
- 目标: 通过 Telegram Bot + User API 下载媒体文件，提供 Bot 交互和 Web 控制台。
- 服务形态: Hono API + Grammy Bot + React/Vite Web 控制台。
- 运行环境: Node.js `>=24`, pnpm `>=10`。

## 目录结构
- `src/`: 后端与 Bot 主体
- `src/api/`: Hono API（配置、任务、Web 登录认证、Telegram 登录、SSE）
- `src/bot/`: Bot 启动与装配（生命周期、命令/回调注册、语言）
- `src/services/`: 核心业务（配置缓存、配置写入管理、任务队列、TDL 进程管理与下载、来源解析、Bot 任务进度、Web 认证、Telegram 认证）
- `src/middlewares/`: Bot 中间件（鉴权、附件下载、链接下载）
- `web/`: React + Vite 前端控制台
- `web/src/pages/`: 路由页面（`/init`、`/login`、`/tasks`、`/settings`）
- `web/src/components/app/`: 应用级布局与导航组件
- `web/src/hooks/`: 前端流程编排（初始化、鉴权守卫、任务操作、SSE/轮询等）

## 关键行为约定
- 下载能力:
  - 下载方案采用 `tdl` (https://github.com/iyear/tdl)，由 `src/services/tdl-service.ts` 驱动，不再使用自研分块下载逻辑。
  - 支持单消息文件下载与频道/群组消息链接下载。
  - 支持媒体组（album）一次下载全部可下载文件（按 `--group` 参数自动聚合）。
  - 下载前按 `setting.mediaTypes` 过滤可下载媒体类型。
  - 任务取消时通过 `AbortController` 即时杀死 `tdl` 子进程并清理临时分片。
  - 免落盘转存 OpenList:
    - 支持直接通过流式管道（Stream Relay）免落盘直传 OpenList (`https://fox.oplist.org/`)。
    - 底层由 `src/services/tdl-stream-server.ts` 启动临时免落盘 HTTP 流服务，由 `src/services/stream-relay-service.ts` 直接 Pipe 至 OpenList `PUT /api/fs/put`。
    - 全链路零本地磁盘落盘，内存占用可控（流式背压），且支持 `As-Task` 后台异步转存模式与实时速率统计。
- 任务模型:
  - 单任务可包含多文件结果。
  - `result.filePath/fileName` 保持兼容（首文件/摘要）。
  - 多文件字段使用 `result.filePaths/fileNames`。
- 任务队列:
  - 任务在内存中管理，`pending -> running -> completed/failed/canceled`。
  - 最多并发运行 `3` 个任务（`MAX_CONCURRENT_RUNNING_TASKS`）。
  - 已结束任务默认保留 `24h`，到期后从任务列表清理并推送 `remove` 事件。
- 任务进度:
  - Web 端优先使用 SSE (`/api/tasks/stream`)。
  - SSE 推送事件为 `snapshot` 与 `task_update`，服务端有 keepalive 心跳。
  - SSE 断开时前端自动重连，并先触发一次全量任务拉取兜底。
  - 若运行环境不支持 `EventSource`，前端降级为 2 秒轮询。
- Bot 进度:
  - 由任务事件驱动（`task-service` 发布事件，`bot-task-progress-service` 订阅并更新消息）。
  - 进度行格式为“进度条 + 百分比”同一行（`📊 [████░░░░░░] 35%`）。
  - 取消确认阶段会暂停该任务的进度消息刷新，避免确认按钮被覆盖。
  - 任务变为 `canceled` 时，Bot 进度消息会被删除。
- 任务取消:
  - 支持 Web API 取消与 Bot 内联按钮取消。
  - Bot 侧为二次确认流程：`取消任务 -> 确认取消/返回`。
  - 取消后任务状态保持为 `canceled`，不会被后续下载异常覆盖成 `failed`。
  - 对 `pending` 任务取消会移除执行载荷，避免任务后续进入下载流程。
  - 若任务由 Bot 发起，Web 端取消时也会触发删除 Bot 进度消息（由事件订阅方统一处理）。
- Bot 回调处理:
  - callback query 相关路径使用安全应答（应答失败会记录日志，不阻断主流程）。
  - 同一来源消息（`sourceKey`）若已有 `pending/running` 任务，会拒绝重复创建任务。
- Web 鉴权:
  - 支持可选 Web 登录（`webUsername` + `webPassword`）。
  - 当 Web 登录已配置时，`/api/*` 默认需要 cookie 会话（公共路径除外）。
  - 会话保存在内存，默认有效期 7 天。
- Bot 重启恢复:
  - Bot 停止/重启时会取消来源为 `bot_message:*` 的活动任务，避免出现无绑定进度消息的悬挂任务。
- 日志:
  - 日志级别支持 `debug|info|warn|error`。
  - 启动初始级别由 `LOG_LEVEL` 环境变量决定（未设置时等效 `error`）。
  - 配置加载后会使用 `setting.logLevel`（默认回落 `info`）。
  - 日志写入 `log/YYYY-MM-DD.log`，默认保留 7 天。

## 开发命令

### 后端（根目录）
- 开发: `pnpm run dev`
- 构建: `pnpm run build`（后端 `tsup` + 前端 `web build`）
- 启动构建产物: `pnpm run start`
- 类型检查: `pnpm run type-check`
- 代码检查: `pnpm run check`（等同 `pnpm run lint`）
- 自动修复: `pnpm run fix`
- 格式化: `pnpm run format`
- 说明: 根目录 `check` 当前只校验后端 `src`（`biome check src`）。

### 前端（web）
- 开发: `pnpm -C web run dev`
- 构建: `pnpm -C web run build`
- Lint: `pnpm -C web run lint`
- 自动修复: `pnpm -C web run fix`
- 格式化: `pnpm -C web run format`

## 代码规范
- 后端:
  - 使用 Biome 规则，提交前至少通过 `pnpm run check` 与 `pnpm run type-check`。
  - 服务层优先承载业务逻辑，中间件与 API 层尽量做编排。
- 前端:
  - 路由使用 `react-router-dom`，当前页面为 `/init`、`/login`、`/tasks`、`/settings`。
  - 组件负责展示，复杂状态与副作用优先放在 hooks。
  - 交互规范：可点击按钮需显示手型指针（`cursor-pointer`），禁用态需显示不可点击光标（`disabled:cursor-not-allowed`）；优先在 `web/src/components/ui/button.tsx` 统一维护。
  - 提交前至少通过 `pnpm -C web run lint` 与 `pnpm -C web run build`。

## 变更建议
- 新增下载能力时，优先修改 `src/services/media-downloader.ts`，并保持任务结果字段兼容。
- 新增任务状态、事件或队列规则时，同步更新:
  - `src/services/task-service.ts`
  - `src/api/app.ts`（SSE 推送结构）
  - `web/src/types/app.ts`
  - `web/src/hooks/use-task-actions.ts` / `web/src/hooks/use-app-effects.ts`
- 新增/调整取消任务行为时，同步检查:
  - `src/services/task-service.ts`（`cancelTask` 与状态流转）
  - `src/services/bot-task-progress-service.ts`（进度消息刷新、暂停与删除）
  - `src/bot/create-bot-instance.ts`（回调按钮与二次确认）
- 新增/调整 Web 登录鉴权行为时，同步检查:
  - `src/services/web-auth-service.ts`（凭据与会话）
  - `src/api/app.ts`（鉴权中间件与登录接口）
  - `web/src/services/api.ts` 与 `web/src/hooks/use-app-effects.ts`（登录态获取与路由守卫）
  - `web/src/pages/login.tsx`（登录页面交互）
- 新增/调整配置初始化或更新行为时，同步检查:
  - `src/services/setting-management-service.ts`（配置校验与持久化写入）
  - `src/services/config-service.ts`（配置读取缓存与变更通知）
  - `src/api/app.ts`（配置 API 入参与响应）
- 改动 UI 时，避免破坏初始化流程与登录守卫逻辑（`/init`、`/login`、`/tasks`、`/settings`）。
