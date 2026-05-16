import { useTranslation } from "react-i18next"
import { useShallow } from "zustand/react/shallow"
import { AppSectionCard } from "@/components/app/AppSectionCard"
import { ConfigFields } from "@/components/app/ConfigFields"
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
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("init.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("init.description")}</p>
        <p className="text-sm text-muted-foreground">{t("init.subtitle", { step: initStep })}</p>
      </div>

      {initStep === 1 ? (
        <>
          <AppSectionCard
            title={t("init.step1.title")}
            titleClassName="text-lg font-semibold tracking-tight"
            contentClassName="space-y-6"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="web-username">
                  {t("config.web_username")}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="web-username"
                  value={form.webUsername}
                  onChange={event => setFormField("webUsername", event.target.value)}
                  placeholder={t("config.web_username_placeholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="web-password">
                  {t("config.web_password")}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="web-password"
                  type="password"
                  value={form.webPassword}
                  onChange={event => setFormField("webPassword", event.target.value)}
                  placeholder={t("config.web_password_placeholder")}
                />
              </div>
            </div>
            <ConfigFields />
            {canProceedInitStepOne ? (
              <p className="text-xs text-muted-foreground">{t("init.step1.description")}</p>
            ) : (
              <p className="text-xs text-destructive">
                {t("init.step1.error", { error: initStepOneIssues[0] })}
              </p>
            )}
          </AppSectionCard>
          <div className="flex justify-end">
            <Button disabled={bootstrapping || !canProceedInitStepOne} onClick={goToInitStepTwo}>
              {t("init.step1.next")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <AppSectionCard
            title={t("init.step2.title")}
            titleClassName="text-lg font-semibold tracking-tight"
            contentClassName="space-y-3"
          >
            <div className="space-y-2">
              <Label htmlFor="auth-phone">{t("init.step2.phone_label")}</Label>
              <Input
                id="auth-phone"
                value={authPhoneNumber}
                onChange={event => setAuthPhoneNumber(event.target.value)}
                placeholder={t("init.step2.phone_placeholder")}
              />
            </div>

            {authCodeSent ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="auth-code">{t("init.step2.code_label")}</Label>
                  <Input
                    id="auth-code"
                    value={authCode}
                    onChange={event => setAuthCode(event.target.value)}
                    placeholder={t("init.step2.code_placeholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-password">{t("init.step2.password_label")}</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    value={authPassword}
                    onChange={event => setAuthPassword(event.target.value)}
                    placeholder={t("init.step2.password_placeholder")}
                  />
                </div>
              </>
            ) : null}

            {authIdentity ? (
              <p className="text-xs text-foreground">
                {t("init.step2.authenticated_as", { identity: authIdentity })}
              </p>
            ) : null}
          </AppSectionCard>

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setInitStep(1)}>
              {t("init.step2.back")}
            </Button>
            <div className="flex flex-wrap gap-2">
              {!authCodeSent ? (
                <Button
                  disabled={bootstrapping || sendingCode}
                  onClick={() => void sendLoginCode()}
                >
                  {sendingCode ? t("init.step2.sending") : t("init.step2.send_code")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={bootstrapping || verifyingCode}
                  onClick={() => void verifyTelegramAuth()}
                >
                  {verifyingCode ? t("init.step2.verifying") : t("init.step2.verify")}
                </Button>
              )}
              <Button
                disabled={bootstrapping || savingConfig || !authSession}
                onClick={() => void initializeSettings()}
              >
                {savingConfig ? t("init.step2.initializing") : t("init.step2.finish")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
