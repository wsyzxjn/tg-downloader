import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Key,
  Layers,
  Loader2,
  RefreshCw,
  Sliders,
  Terminal,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useShallow } from "zustand/react/shallow"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { MEDIA_TYPE_OPTIONS } from "@/constants/app"
import { cn } from "@/lib/utils"
import { fetchTdlStatus, testOpenList } from "@/services/api"
import { useConfigStore } from "@/store/configStore"
import type { OpenListTestResponse, TdlStatusResponse } from "@/types/app"

export function ConfigFields() {
  const { t } = useTranslation()
  const {
    allowedUserIdsInput,
    form,
    mediaTypes,
    setAllowedUserIdsInput,
    setFormField,
    testingProxy,
    testProxyConnection,
    toggleMediaType,
  } = useConfigStore(
    useShallow(state => ({
      allowedUserIdsInput: state.allowedUserIdsInput,
      form: state.form,
      mediaTypes: state.mediaTypes,
      setAllowedUserIdsInput: state.setAllowedUserIdsInput,
      setFormField: state.setFormField,
      testingProxy: state.testingProxy,
      testProxyConnection: state.testProxyConnection,
      toggleMediaType: state.toggleMediaType,
    }))
  )

  const [showApiHash, setShowApiHash] = useState(false)
  const [showBotToken, setShowBotToken] = useState(false)
  const [showOpenListPassword, setShowOpenListPassword] = useState(false)

  const [tdlStatus, setTdlStatus] = useState<TdlStatusResponse | null>(null)
  const [checkingTdl, setCheckingTdl] = useState(false)

  const [testingOpenList, setTestingOpenList] = useState(false)
  const [openListTestResult, setOpenListTestResult] = useState<OpenListTestResponse | null>(null)

  const proxyEnabled = form.proxyType !== "none"

  useEffect(() => {
    let active = true
    const run = async () => {
      setCheckingTdl(true)
      try {
        const res = await fetchTdlStatus()
        if (active) setTdlStatus(res)
      } catch {
        if (active) {
          setTdlStatus({
            installed: false,
            authorized: false,
            namespace: form.tdlNamespace || "default",
            error: "无法连接到后端服务",
          })
        }
      } finally {
        if (active) setCheckingTdl(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [form.tdlNamespace])

  const handleTestOpenList = async () => {
    if (!form.openListBaseUrl || !form.openListUsername || !form.openListPassword) {
      setOpenListTestResult({
        ok: false,
        message: "请先填写 OpenList 服务地址、用户名和密码",
      })
      return
    }

    setTestingOpenList(true)
    setOpenListTestResult(null)
    try {
      const res = await testOpenList({
        baseUrl: form.openListBaseUrl.trim(),
        username: form.openListUsername.trim(),
        password: form.openListPassword.trim(),
      })
      setOpenListTestResult(res)
    } catch (err) {
      setOpenListTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingOpenList(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. TDL 下载引擎 */}
      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("config.section_tdl", "TDL 引擎与下载设置")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {tdlStatus ? (
              tdlStatus.installed ? (
                <Badge
                  variant={tdlStatus.authorized ? "success" : "warning"}
                  className="flex items-center gap-1 font-mono text-[11px]"
                >
                  {tdlStatus.authorized ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  <span>TDL v{tdlStatus.version || "0.20.1"}</span>
                  <span>
                    (
                    {tdlStatus.authorized
                      ? t("config.tdl_authorized", "已登录")
                      : t("config.tdl_not_authorized", "未登录")}
                    )
                  </span>
                </Badge>
              ) : (
                <Badge variant="destructive" className="font-mono text-[11px]">
                  {t("config.tdl_not_installed", "未检测到 TDL")}
                </Badge>
              )
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCheckingTdl(true)
                void fetchTdlStatus()
                  .then(setTdlStatus)
                  .finally(() => setCheckingTdl(false))
              }}
              disabled={checkingTdl}
              className="h-7 px-2.5 text-xs"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", checkingTdl && "animate-spin")} />
              <span>
                {checkingTdl
                  ? t("config.tdl_checking", "检测中...")
                  : t("config.tdl_check", "检测状态")}
              </span>
            </Button>
          </div>
        </div>

        {tdlStatus && !tdlStatus.authorized ? (
          <div className="flex items-start gap-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300">
            <Terminal className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">
                {t("config.tdl_not_authorized", "TDL 当前尚未登录 Telegram 账号")}
              </p>
              <p className="text-[11px] opacity-90">{t("config.tdl_hint")}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tdl-path" className="text-xs font-medium text-foreground">
              {t("config.tdl_path", "TDL 程序路径")}
            </Label>
            <Input
              id="tdl-path"
              value={form.tdlPath || ""}
              onChange={event => setFormField("tdlPath", event.target.value)}
              placeholder={tdlStatus?.path || t("config.tdl_path_placeholder", "留空默认自动检测")}
              className="font-mono text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tdl-namespace" className="text-xs font-medium text-foreground">
              {t("config.tdl_namespace", "TDL 命名空间")}
            </Label>
            <Input
              id="tdl-namespace"
              value={form.tdlNamespace || "default"}
              onChange={event => setFormField("tdlNamespace", event.target.value)}
              placeholder="default"
              className="font-mono text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tdl-threads" className="text-xs font-medium text-foreground">
              {t("config.tdl_threads", "单任务下载线程数")}
            </Label>
            <Input
              id="tdl-threads"
              value={form.tdlThreads || "4"}
              onChange={event =>
                setFormField("tdlThreads", event.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="4"
              className="font-mono text-xs sm:text-sm"
              type="number"
              min={1}
              max={32}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="download-file-concurrency"
              className="text-xs font-medium text-foreground"
            >
              {t("config.download_file_concurrency")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Input
              id="download-file-concurrency"
              value={form.downloadFileConcurrency}
              onChange={event =>
                setFormField("downloadFileConcurrency", event.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="3"
              className="font-mono text-xs sm:text-sm"
              type="number"
              min={1}
              max={8}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="download-dir" className="text-xs font-medium text-foreground">
              {t("config.download_dir")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Input
              id="download-dir"
              value={form.downloadDir}
              onChange={event => setFormField("downloadDir", event.target.value)}
              placeholder={t("config.download_dir_placeholder")}
              className="font-mono text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* 2. OpenList 存储网盘免落盘转存配置 */}
      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("config.section_openlist", "OpenList 存储网盘转存（免落盘）")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={form.openListEnabled}
                onChange={event => setFormField("openListEnabled", event.target.checked)}
                className="rounded border-border/70 h-4 w-4 text-primary focus:ring-1 focus:ring-ring"
              />
              <span>{t("config.openlist_enabled", "启用 OpenList 转存")}</span>
            </label>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("config.openlist_desc")}</p>

        {form.openListEnabled ? (
          <div className="space-y-4 pt-1">
            {/* Storage Target Selector */}
            <div className="space-y-1.5 max-w-sm">
              <Label className="text-xs font-medium text-foreground">
                {t("config.storage_target", "转存存储模式")}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormField("storageTarget", "local")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                    form.storageTarget === "local"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <HardDrive className="h-3.5 w-3.5" />
                  <span>{t("config.storage_target_local", "仅保存到本地磁盘")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormField("storageTarget", "openlist")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                    form.storageTarget === "openlist"
                      ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Cloud className="h-3.5 w-3.5 text-sky-500" />
                  <span>{t("config.storage_target_openlist", "免落盘直传 OpenList")}</span>
                </button>
              </div>
            </div>

            {/* OpenList Connection details */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="openlist-base-url" className="text-xs font-medium text-foreground">
                  {t("config.openlist_base_url", "OpenList 服务地址")}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  id="openlist-base-url"
                  value={form.openListBaseUrl}
                  onChange={event => setFormField("openListBaseUrl", event.target.value)}
                  placeholder={t("config.openlist_base_url_placeholder", "https://pan.example.com")}
                  className="font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label
                  htmlFor="openlist-target-dir"
                  className="text-xs font-medium text-foreground"
                >
                  {t("config.openlist_target_dir", "转存目标路径")}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  id="openlist-target-dir"
                  value={form.openListTargetDir}
                  onChange={event => setFormField("openListTargetDir", event.target.value)}
                  placeholder="/Telegram"
                  className="font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="openlist-username" className="text-xs font-medium text-foreground">
                  {t("config.openlist_username", "OpenList 用户名")}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  id="openlist-username"
                  value={form.openListUsername}
                  onChange={event => setFormField("openListUsername", event.target.value)}
                  placeholder="admin"
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="openlist-password" className="text-xs font-medium text-foreground">
                  {t("config.openlist_password", "OpenList 密码")}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="openlist-password"
                    type={showOpenListPassword ? "text" : "password"}
                    value={form.openListPassword}
                    onChange={event => setFormField("openListPassword", event.target.value)}
                    placeholder={t("config.openlist_password_placeholder", "请输入密码")}
                    className="text-xs sm:text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenListPassword(!showOpenListPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  >
                    {showOpenListPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTestOpenList()}
                  disabled={
                    testingOpenList ||
                    !form.openListBaseUrl ||
                    !form.openListUsername ||
                    !form.openListPassword
                  }
                  className="h-9 w-full text-xs"
                >
                  {testingOpenList ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>{t("config.testing_openlist", "测试中...")}</span>
                    </>
                  ) : (
                    <span>{t("config.test_openlist", "测试 OpenList 连接")}</span>
                  )}
                </Button>
              </div>
            </div>

            {/* Test result feedback banner */}
            {openListTestResult ? (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md p-3 text-xs border",
                  openListTestResult.ok
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                )}
              >
                {openListTestResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span>
                  {openListTestResult.ok
                    ? t("messages.openlist_test_success", { user: openListTestResult.username })
                    : `${t("messages.openlist_test_failed")}: ${openListTestResult.message}`}
                </span>
              </div>
            ) : null}

            {/* As-Task Toggle */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.openListAsTask}
                  onChange={event => setFormField("openListAsTask", event.target.checked)}
                  className="rounded border-border/70 h-4 w-4 text-primary focus:ring-1 focus:ring-ring mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground">
                    {t("config.openlist_as_task", "使用 OpenList 后台任务异步处理 (As-Task)")}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {t("config.openlist_as_task_hint")}
                  </p>
                </div>
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {/* 3. Telegram API 与 Bot 配置 */}
      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Key className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("config.section_tg", "Telegram API 与机器人配置")}
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="bot-token" className="text-xs font-medium text-foreground">
              {t("config.bot_token")}
            </Label>
            <div className="relative">
              <Input
                id="bot-token"
                type={showBotToken ? "text" : "password"}
                value={form.botToken}
                onChange={event => setFormField("botToken", event.target.value)}
                placeholder={t("config.bot_token_placeholder")}
                className="font-mono text-xs sm:text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowBotToken(!showBotToken)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              >
                {showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-id" className="text-xs font-medium text-foreground">
              {t("config.api_id")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Input
              id="api-id"
              value={form.apiId}
              onChange={event => setFormField("apiId", event.target.value)}
              placeholder={t("config.api_id_placeholder")}
              className="font-mono text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-hash" className="text-xs font-medium text-foreground">
              {t("config.api_hash")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <div className="relative">
              <Input
                id="api-hash"
                type={showApiHash ? "text" : "password"}
                value={form.apiHash}
                onChange={event => setFormField("apiHash", event.target.value)}
                placeholder={t("config.api_hash_placeholder")}
                className="font-mono text-xs sm:text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiHash(!showApiHash)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              >
                {showApiHash ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 网络与代理设置 */}
      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("config.section_network", "网络与代理配置")}
          </h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="proxy-type" className="text-xs font-medium text-foreground">
              {t("config.proxy_type")}
            </Label>
            <select
              id="proxy-type"
              value={form.proxyType}
              onChange={event =>
                setFormField("proxyType", event.target.value as "none" | "socks5" | "socks4")
              }
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="none">{t("config.proxy_type_none")}</option>
              <option value="socks5">SOCKS5</option>
              <option value="socks4">SOCKS4</option>
            </select>
          </div>

          {proxyEnabled ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="proxy-host" className="text-xs font-medium text-foreground">
                  {t("config.proxy_host")}
                </Label>
                <Input
                  id="proxy-host"
                  value={form.proxyHost}
                  onChange={event => setFormField("proxyHost", event.target.value)}
                  placeholder={t("config.proxy_host_placeholder")}
                  className="font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proxy-port" className="text-xs font-medium text-foreground">
                  {t("config.proxy_port")}
                </Label>
                <Input
                  id="proxy-port"
                  value={form.proxyPort}
                  onChange={event => setFormField("proxyPort", event.target.value)}
                  placeholder={t("config.proxy_port_placeholder")}
                  className="font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => void testProxyConnection()}
                  disabled={testingProxy}
                >
                  {testingProxy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>{t("config.testing_proxy")}</span>
                    </>
                  ) : (
                    <span>{t("config.test_proxy")}</span>
                  )}
                </Button>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="proxy-username" className="text-xs font-medium text-foreground">
                  {t("config.proxy_username")}
                </Label>
                <Input
                  id="proxy-username"
                  value={form.proxyUsername}
                  onChange={event => setFormField("proxyUsername", event.target.value)}
                  placeholder={t("config.proxy_username_placeholder")}
                  className="font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="proxy-password" className="text-xs font-medium text-foreground">
                  {t("config.proxy_password")}
                </Label>
                <Input
                  id="proxy-password"
                  type="password"
                  value={form.proxyPassword}
                  onChange={event => setFormField("proxyPassword", event.target.value)}
                  placeholder={t("config.proxy_password_placeholder")}
                  className="font-mono text-xs sm:text-sm"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 5. 媒体类型与权限 */}
      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("config.section_media", "媒体类型与权限过滤")}
          </h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">
              {t("config.media_types")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              {MEDIA_TYPE_OPTIONS.map(mediaType => {
                const selected = mediaTypes.includes(mediaType)

                return (
                  <button
                    key={mediaType}
                    type="button"
                    onClick={() => toggleMediaType(mediaType)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs sm:text-sm transition-all duration-150 cursor-pointer",
                      selected
                        ? "border-primary/80 bg-primary/10 text-foreground font-medium shadow-2xs"
                        : "border-border/70 bg-card/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    <span>{t(`config.media_labels.${mediaType}` as const)}</span>
                    {selected ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="allowed-user-ids" className="text-xs font-medium text-foreground">
              {t("config.allowed_user_ids")}
            </Label>
            <Input
              id="allowed-user-ids"
              value={allowedUserIdsInput}
              onChange={event => setAllowedUserIdsInput(event.target.value)}
              placeholder={t("config.allowed_user_ids_placeholder")}
              className="font-mono text-xs sm:text-sm"
            />
            <p className="text-[11px] text-muted-foreground">{t("config.allowed_user_ids_hint")}</p>
          </div>
        </div>
      </div>

      {/* 6. 系统日志 */}
      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Sliders className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t("config.log_level")}</h3>
        </div>

        <div className="max-w-xs space-y-1.5">
          <select
            id="log-level"
            value={form.logLevel}
            onChange={event =>
              setFormField("logLevel", event.target.value as "debug" | "info" | "warn" | "error")
            }
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="debug">{t("config.log_level_options.debug")}</option>
            <option value="info">{t("config.log_level_options.info")}</option>
            <option value="warn">{t("config.log_level_options.warn")}</option>
            <option value="error">{t("config.log_level_options.error")}</option>
          </select>
        </div>
      </div>
    </div>
  )
}
