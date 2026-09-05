import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Laptop,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { cn } from "@/lib/utils"
import {
  cancelTdlQrLogin,
  getTdlQrLoginStatus,
  importTdlDesktopSession,
  startTdlQrLogin,
  submitTdl2faPassword,
} from "@/services/api"
import type { TdlQrLoginResponse } from "@/types/app"

interface TdlLoginDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function TdlLoginDialog({ onClose, onSuccess, open }: TdlLoginDialogProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<"qr" | "desktop">("qr")

  // QR login state
  const [qrState, setQrState] = useState<TdlQrLoginResponse>({ status: "idle" })
  const [twoFaPassword, setTwoFaPassword] = useState("")
  const [submitting2fa, setSubmitting2fa] = useState(false)

  // Desktop import state
  const [desktopPath, setDesktopPath] = useState("")
  const [desktopPasscode, setDesktopPasscode] = useState("")
  const [importingDesktop, setImportingDesktop] = useState(false)
  const [desktopResult, setDesktopResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [qrAttempt, setQrAttempt] = useState(0)

  const handleStartQr = () => {
    setQrAttempt(c => c + 1)
  }

  const handleCancel = () => {
    void cancelTdlQrLogin()
    onClose()
  }

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!twoFaPassword.trim()) return

    setSubmitting2fa(true)
    try {
      const res = await submitTdl2faPassword(twoFaPassword.trim())
      setQrState(res)
      if (res.status === "success") {
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      }
    } catch (err) {
      setQrState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : "2FA 密码错误",
      }))
    } finally {
      setSubmitting2fa(false)
    }
  }

  const handleDesktopImport = async (e: React.FormEvent) => {
    e.preventDefault()
    setImportingDesktop(true)
    setDesktopResult(null)
    try {
      const res = await importTdlDesktopSession({
        desktopPath: desktopPath.trim() || undefined,
        passcode: desktopPasscode.trim() || undefined,
      })
      setDesktopResult(res)
      if (res.ok) {
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      }
    } catch (err) {
      setDesktopResult({
        ok: false,
        message: err instanceof Error ? err.message : "桌面端导入失败",
      })
    } finally {
      setImportingDesktop(false)
    }
  }

  useEffect(() => {
    void qrAttempt
    let active = true
    if (open && activeTab === "qr") {
      setQrState({ status: "starting" })
      setTwoFaPassword("")
      void startTdlQrLogin()
        .then(init => {
          if (active) setQrState(init)
        })
        .catch(err => {
          if (active) {
            setQrState({
              status: "failed",
              error: err instanceof Error ? err.message : "无法启动扫码登录",
            })
          }
        })

      const timer = setInterval(() => {
        void getTdlQrLoginStatus()
          .then(state => {
            if (!active) return
            setQrState(state)
            if (state.status === "success") {
              clearInterval(timer)
              setTimeout(() => {
                onSuccess()
                onClose()
              }, 1500)
            }
          })
          .catch(() => {})
      }, 1500)

      return () => {
        active = false
        clearInterval(timer)
      }
    }

    if (!open) {
      void cancelTdlQrLogin()
    }

    return () => {
      active = false
    }
  }, [open, activeTab, qrAttempt, onClose, onSuccess])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-lg border border-border/80 bg-card text-card-foreground shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              {t("tdl_login.title", "登录 Telegram (TDL 引擎)")}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xs p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 border-b border-border/40 text-center text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2 cursor-pointer",
              activeTab === "qr"
                ? "border-primary text-foreground font-semibold bg-muted/30"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>{t("tdl_login.tab_qr", "扫码登录 (推荐)")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("desktop")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2 cursor-pointer",
              activeTab === "desktop"
                ? "border-primary text-foreground font-semibold bg-muted/30"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Laptop className="h-3.5 w-3.5" />
            <span>{t("tdl_login.tab_desktop", "桌面端导入")}</span>
          </button>
        </div>

        {/* Tab 1: QR Code Login */}
        {activeTab === "qr" ? (
          <div className="p-6 space-y-4 text-center">
            {qrState.status === "starting" ? (
              <div className="h-56 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs">{t("tdl_login.generating_qr", "正在生成登录二维码...")}</p>
              </div>
            ) : qrState.status === "qr_ready" && qrState.qrSvg ? (
              <div className="space-y-4">
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(qrState.qrSvg)}`}
                  alt="Telegram Login QR Code"
                  className="mx-auto w-52 h-52 rounded-lg border border-border/50 shadow-xs bg-white p-1 object-contain"
                />

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {t("tdl_login.qr_instruction_title", "请使用 Telegram 手机端扫码")}
                  </p>
                  <p className="text-[11px]">
                    {t(
                      "tdl_login.qr_instruction_step",
                      "设置 → 设备 → 连接桌面设备，对准上方二维码"
                    )}
                  </p>
                </div>
              </div>
            ) : qrState.status === "waiting_password" ? (
              <form onSubmit={handle2faSubmit} className="space-y-4 py-3 text-left">
                <div className="flex items-center gap-2 text-amber-500 text-xs font-medium">
                  <KeyRound className="h-4 w-4" />
                  <span>{t("tdl_login.2fa_required", "该账号已开启两步验证，请输入二次密码")}</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="2fa-input" className="text-xs">
                    {t("tdl_login.2fa_password", "二次验证密码 (2FA)")}
                  </Label>
                  <Input
                    id="2fa-input"
                    type="password"
                    value={twoFaPassword}
                    onChange={e => setTwoFaPassword(e.target.value)}
                    placeholder={t("tdl_login.2fa_placeholder", "请输入 2FA 密码")}
                    className="text-sm"
                    autoFocus
                  />
                </div>
                {qrState.error ? <p className="text-xs text-destructive">{qrState.error}</p> : null}
                <Button
                  type="submit"
                  disabled={submitting2fa || !twoFaPassword.trim()}
                  className="w-full"
                >
                  {submitting2fa ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  <span>{t("tdl_login.submit_password", "提交密码")}</span>
                </Button>
              </form>
            ) : qrState.status === "success" ? (
              <div className="h-56 flex flex-col items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{t("tdl_login.success", "登录成功！")}</p>
                  {qrState.user?.username ? (
                    <p className="text-xs text-muted-foreground font-mono">
                      @{qrState.user.username} (ID: {qrState.user.id})
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="h-56 flex flex-col items-center justify-center gap-3 text-destructive">
                <AlertCircle className="h-8 w-8" />
                <p className="text-xs font-medium">
                  {qrState.error || t("tdl_login.failed", "登录遇到问题")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleStartQr()}
                  className="mt-2"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  <span>{t("tdl_login.retry_qr", "重新生成二维码")}</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Tab 2: Desktop Import */
          <form onSubmit={handleDesktopImport} className="p-6 space-y-4">
            <div className="rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">
                {t("tdl_login.desktop_hint_title", "直接导入本地 Telegram 桌面客户端会话")}
              </p>
              <p>
                {t(
                  "tdl_login.desktop_hint_desc",
                  "无需手机扫码，系统将自动读取已登录客户端的 tdata 会话并授权至 TDL。"
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desktop-path" className="text-xs">
                {t("tdl_login.desktop_path", "客户端数据路径 (可选)")}
              </Label>
              <Input
                id="desktop-path"
                value={desktopPath}
                onChange={e => setDesktopPath(e.target.value)}
                placeholder={t("tdl_login.desktop_path_placeholder", "留空将自动检索系统默认路径")}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desktop-passcode" className="text-xs">
                {t("tdl_login.desktop_passcode", "本地锁屏密码 (可选)")}
              </Label>
              <Input
                id="desktop-passcode"
                type="password"
                value={desktopPasscode}
                onChange={e => setDesktopPasscode(e.target.value)}
                placeholder={t(
                  "tdl_login.desktop_passcode_placeholder",
                  "若客户端设置了本地密码则填写"
                )}
                className="text-xs"
              />
            </div>

            {desktopResult ? (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md p-3 text-xs border",
                  desktopResult.ok
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                )}
              >
                {desktopResult.ok ? (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span>{desktopResult.message}</span>
              </div>
            ) : null}

            <Button type="submit" disabled={importingDesktop} className="w-full">
              {importingDesktop ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              <span>
                {importingDesktop
                  ? t("tdl_login.importing", "正在导入会话...")
                  : t("tdl_login.import_btn", "一键导入会话")}
              </span>
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
