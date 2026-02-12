import { Aperture, FileText, Film, Image, Mic, Music, Smile, Video } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MEDIA_TYPE_OPTIONS } from "@/constants/app"
import { useAppFlow } from "@/context/app-context"
import { cn } from "@/lib/utils"

const MEDIA_ICONS: Record<string, React.ElementType> = {
  photo: Image,
  animation: Aperture,
  audio: Music,
  document: FileText,
  video: Film,
  video_note: Video,
  voice: Mic,
  sticker: Smile,
}

export function ConfigFields() {
  const { t } = useTranslation()
  const { initFlow } = useAppFlow()
  const {
    allowedUserIdsInput,
    form,
    mediaTypes,
    setAllowedUserIdsInput,
    setForm,
    testingProxy,
    toggleMediaType,
  } = initFlow

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="bot-token" className="text-sm font-medium text-foreground">
          {t("config.bot_token")}
        </Label>
        <Input
          id="bot-token"
          value={form.botToken}
          onChange={event => setForm(prev => ({ ...prev, botToken: event.target.value }))}
          placeholder={t("config.bot_token_placeholder")}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="api-id" className="text-sm font-medium text-foreground">
          {t("config.api_id")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="api-id"
          value={form.apiId}
          onChange={event =>
            setForm(prev => ({
              ...prev,
              apiId: event.target.value,
            }))
          }
          placeholder={t("config.api_id_placeholder")}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="api-hash" className="text-sm font-medium text-foreground">
          {t("config.api_hash")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="api-hash"
          type="password"
          value={form.apiHash}
          onChange={event =>
            setForm(prev => ({
              ...prev,
              apiHash: event.target.value,
            }))
          }
          placeholder={t("config.api_hash_placeholder")}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-4 rounded-lg border border-border/50 bg-muted/20 p-4 md:col-span-2">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="proxy-type" className="text-xs text-muted-foreground">
              {t("config.proxy_type")}
            </Label>
            <select
              id="proxy-type"
              value={form.proxyType}
              onChange={event =>
                setForm(prev => ({
                  ...prev,
                  proxyType: event.target.value as "none" | "socks5" | "socks4",
                }))
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="none">{t("config.proxy_type_none")}</option>
              <option value="socks5">SOCKS5</option>
              <option value="socks4">SOCKS4</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="proxy-host" className="text-xs text-muted-foreground">
              {t("config.proxy_host")}
            </Label>
            <Input
              id="proxy-host"
              value={form.proxyHost}
              onChange={event => setForm(prev => ({ ...prev, proxyHost: event.target.value }))}
              placeholder={t("config.proxy_host_placeholder")}
              className="font-mono text-sm"
              disabled={form.proxyType === "none"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxy-port" className="text-xs text-muted-foreground">
              {t("config.proxy_port")}
            </Label>
            <Input
              id="proxy-port"
              value={form.proxyPort}
              onChange={event => setForm(prev => ({ ...prev, proxyPort: event.target.value }))}
              placeholder={t("config.proxy_port_placeholder")}
              className="font-mono text-sm"
              disabled={form.proxyType === "none"}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs opacity-0 select-none">&nbsp;</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void initFlow.handleTestProxy()}
              disabled={testingProxy || form.proxyType === "none"}
            >
              {testingProxy ? t("config.testing_proxy") : t("config.test_proxy")}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="proxy-username" className="text-xs text-muted-foreground">
              {t("config.proxy_username")}
            </Label>
            <Input
              id="proxy-username"
              value={form.proxyUsername}
              onChange={event =>
                setForm(prev => ({
                  ...prev,
                  proxyUsername: event.target.value,
                }))
              }
              placeholder={t("config.proxy_username_placeholder")}
              className="font-mono text-sm"
              disabled={form.proxyType === "none"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxy-password" className="text-xs text-muted-foreground">
              {t("config.proxy_password")}
            </Label>
            <Input
              id="proxy-password"
              type="password"
              value={form.proxyPassword}
              onChange={event =>
                setForm(prev => ({
                  ...prev,
                  proxyPassword: event.target.value,
                }))
              }
              placeholder={t("config.proxy_password_placeholder")}
              className="font-mono text-sm"
              disabled={form.proxyType === "none"}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="download-file-concurrency" className="text-sm font-medium text-foreground">
          {t("config.download_file_concurrency")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="download-file-concurrency"
          value={form.downloadFileConcurrency}
          onChange={event => {
            const nextRaw = event.target.value.replace(/[^\d]/g, "")
            setForm(prev => ({
              ...prev,
              downloadFileConcurrency: nextRaw,
            }))
          }}
          placeholder={t("config.download_file_concurrency_placeholder")}
          className="font-mono text-sm"
          type="number"
          min={1}
          max={8}
          step={1}
          inputMode="numeric"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="log-level" className="text-sm font-medium text-foreground">
          {t("config.log_level")}
          <span className="text-red-500">*</span>
        </Label>
        <select
          id="log-level"
          value={form.logLevel}
          onChange={event =>
            setForm(prev => ({
              ...prev,
              logLevel: event.target.value as "debug" | "info" | "warn" | "error",
            }))
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="debug">{t("config.log_level_options.debug")}</option>
          <option value="info">{t("config.log_level_options.info")}</option>
          <option value="warn">{t("config.log_level_options.warn")}</option>
          <option value="error">{t("config.log_level_options.error")}</option>
        </select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="download-dir" className="text-sm font-medium text-foreground">
          {t("config.download_dir")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="download-dir"
          value={form.downloadDir}
          onChange={event => setForm(prev => ({ ...prev, downloadDir: event.target.value }))}
          placeholder={t("config.download_dir_placeholder")}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="allowed-user-ids" className="text-sm font-medium text-foreground">
          {t("config.allowed_user_ids")}
        </Label>
        <Input
          id="allowed-user-ids"
          value={allowedUserIdsInput}
          onChange={event => setAllowedUserIdsInput(event.target.value)}
          placeholder={t("config.allowed_user_ids_placeholder")}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">{t("config.allowed_user_ids_hint")}</p>
      </div>

      <div className="space-y-3 md:col-span-2">
        <Label className="text-sm font-medium text-foreground">
          {t("config.media_types")}
          <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MEDIA_TYPE_OPTIONS.map(mediaType => {
            const Icon = MEDIA_ICONS[mediaType] || FileText
            const selected = mediaTypes.includes(mediaType)

            return (
              <button
                key={mediaType}
                type="button"
                onClick={() => toggleMediaType(mediaType)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(`config.media_labels.${mediaType}` as const)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
