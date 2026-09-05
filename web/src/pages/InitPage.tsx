import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Key,
  Lock,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useShallow } from "zustand/react/shallow"
import { AppSectionCard } from "@/components/app/AppSectionCard"
import { ConfigFields } from "@/components/app/ConfigFields"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { useConfigStore } from "@/store/configStore"
import { useUiStore } from "@/store/uiStore"
import { validateStepOne } from "@/utils/app"

export function InitPage() {
  const { t } = useTranslation()
  const {
    allowedUserIdsInput,
    authCode,
    authCodeSent,
    authIdentity,
    authPassword,
    authPhoneNumber,
    authSession,
    form,
    goToInitStepTwo,
    initStep,
    initializeSettings,
    mediaTypes,
    savingConfig,
    sendLoginCode,
    sendingCode,
    setAuthCode,
    setAuthPassword,
    setAuthPhoneNumber,
    setFormField,
    setInitStep,
    verifyTelegramAuth,
    verifyingCode,
  } = useConfigStore(
    useShallow(state => ({
      allowedUserIdsInput: state.allowedUserIdsInput,
      authCode: state.authCode,
      authCodeSent: state.authCodeSent,
      authIdentity: state.authIdentity,
      authPassword: state.authPassword,
      authPhoneNumber: state.authPhoneNumber,
      authSession: state.authSession,
      form: state.form,
      goToInitStepTwo: state.goToInitStepTwo,
      initStep: state.initStep,
      initializeSettings: state.initializeSettings,
      mediaTypes: state.mediaTypes,
      savingConfig: state.savingConfig,
      sendLoginCode: state.sendLoginCode,
      sendingCode: state.sendingCode,
      setAuthCode: state.setAuthCode,
      setAuthPassword: state.setAuthPassword,
      setAuthPhoneNumber: state.setAuthPhoneNumber,
      setFormField: state.setFormField,
      setInitStep: state.setInitStep,
      verifyTelegramAuth: state.verifyTelegramAuth,
      verifyingCode: state.verifyingCode,
    }))
  )
  const bootstrapping = useUiStore(state => state.bootstrapping)
  const initStepOneIssues = validateStepOne(form, allowedUserIdsInput, mediaTypes, t)
  const canProceedInitStepOne = initStepOneIssues.length === 0

  return (
    <div className="space-y-6">
      {/* Header & Step progress */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {t("init.title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("init.description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={initStep === 1 ? "default" : "success"}
            className="h-6 px-2 text-xs font-mono"
          >
            1. {t("init.step1.title", "基础配置")}
          </Badge>
          <span className="text-muted-foreground/50">→</span>
          <Badge
            variant={initStep === 2 ? "default" : "outline"}
            className="h-6 px-2 text-xs font-mono"
          >
            2. {t("init.step2.title", "身份验证")}
          </Badge>
        </div>
      </div>

      {initStep === 1 ? (
        <>
          <AppSectionCard
            title={t("init.step1.title")}
            subtitle={t("init.description")}
            contentClassName="space-y-6 pt-4"
          >
            {/* Web Credentials Box */}
            <div className="rounded-lg border border-border/60 bg-muted/25 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Web 控制台登录凭据</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="web-username" className="text-xs font-medium text-foreground">
                    {t("config.web_username")}
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-muted-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <Input
                      id="web-username"
                      value={form.webUsername}
                      onChange={event => setFormField("webUsername", event.target.value)}
                      placeholder={t("config.web_username_placeholder")}
                      className="pl-8 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="web-password" className="text-xs font-medium text-foreground">
                    {t("config.web_password")}
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-muted-foreground">
                      <Key className="h-4 w-4" />
                    </div>
                    <Input
                      id="web-password"
                      type="password"
                      value={form.webPassword}
                      onChange={event => setFormField("webPassword", event.target.value)}
                      placeholder={t("config.web_password_placeholder")}
                      className="pl-8 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <ConfigFields />

            <div className="pt-2">
              {canProceedInitStepOne ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>{t("init.step1.description")}</span>
                </p>
              ) : (
                <p className="text-xs text-destructive font-medium">
                  {t("init.step1.error", { error: initStepOneIssues[0] })}
                </p>
              )}
            </div>
          </AppSectionCard>

          <div className="flex justify-end pt-2">
            <Button
              disabled={bootstrapping || !canProceedInitStepOne}
              onClick={goToInitStepTwo}
              className="h-10 px-6 font-medium"
            >
              <span>{t("init.step1.next")}</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <AppSectionCard
            title={t("init.step2.title")}
            subtitle="通过 Telegram 账号验证以获取访问权限与 Session"
            contentClassName="space-y-5 pt-4"
          >
            <div className="max-w-md space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="auth-phone" className="text-xs font-medium text-foreground">
                  {t("init.step2.phone_label")}
                </Label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                  </div>
                  <Input
                    id="auth-phone"
                    value={authPhoneNumber}
                    onChange={event => setAuthPhoneNumber(event.target.value)}
                    placeholder={t("init.step2.phone_placeholder")}
                    className="pl-9 font-mono text-sm"
                  />
                </div>
              </div>

              {authCodeSent ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-code" className="text-xs font-medium text-foreground">
                      {t("init.step2.code_label")}
                    </Label>
                    <Input
                      id="auth-code"
                      value={authCode}
                      onChange={event => setAuthCode(event.target.value)}
                      placeholder={t("init.step2.code_placeholder")}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-password" className="text-xs font-medium text-foreground">
                      {t("init.step2.password_label")}
                    </Label>
                    <Input
                      id="auth-password"
                      type="password"
                      value={authPassword}
                      onChange={event => setAuthPassword(event.target.value)}
                      placeholder={t("init.step2.password_placeholder")}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {authIdentity ? (
                <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>{t("init.step2.authenticated_as", { identity: authIdentity })}</span>
                </div>
              ) : null}
            </div>
          </AppSectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setInitStep(1)} className="h-10 px-4">
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span>{t("init.step2.back")}</span>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {!authCodeSent ? (
                <Button
                  disabled={bootstrapping || sendingCode || !authPhoneNumber.trim()}
                  onClick={() => void sendLoginCode()}
                  className="h-10 px-5"
                >
                  {sendingCode ? t("init.step2.sending") : t("init.step2.send_code")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={bootstrapping || verifyingCode || !authCode.trim()}
                  onClick={() => void verifyTelegramAuth()}
                  className="h-10 px-5"
                >
                  {verifyingCode ? t("init.step2.verifying") : t("init.step2.verify_code")}
                </Button>
              )}
              <Button
                disabled={bootstrapping || savingConfig || !authSession}
                onClick={() => void initializeSettings()}
                className="h-10 px-6 font-medium"
              >
                {savingConfig
                  ? t("init.submit_loading", "初始化中...")
                  : t("init.submit", "完成初始化")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
