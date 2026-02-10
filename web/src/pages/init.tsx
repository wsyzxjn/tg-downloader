import { Save } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { ConfigFields } from "@/components/app/config-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SettingForm } from "@/types/app"

interface InitPageProps {
  initStep: 1 | 2
  loading: boolean
  savingConfig: boolean
  form: SettingForm
  setForm: Dispatch<SetStateAction<SettingForm>>
  allowedUserIdsInput: string
  setAllowedUserIdsInput: Dispatch<SetStateAction<string>>
  mediaTypes: string[]
  toggleMediaType: (mediaType: string) => void
  testingProxy: boolean
  initStepOneIssues: string[]
  canProceedInitStepOne: boolean
  authPhoneNumber: string
  setAuthPhoneNumber: (value: string) => void
  authCodeSent: boolean
  authCode: string
  setAuthCode: (value: string) => void
  authPassword: string
  setAuthPassword: (value: string) => void
  authSession: string
  authIdentity: string
  sendingCode: boolean
  verifyingCode: boolean
  onInitStepNext: () => void
  onBackToStepOne: () => void
  onSendLoginCode: () => void
  onVerifyLogin: () => void
  onInitConfig: () => void
  onTestProxy: () => void
}

export function InitPage({
  initStep,
  loading,
  savingConfig,
  form,
  setForm,
  allowedUserIdsInput,
  setAllowedUserIdsInput,
  mediaTypes,
  toggleMediaType,
  testingProxy,
  initStepOneIssues,
  canProceedInitStepOne,
  authPhoneNumber,
  setAuthPhoneNumber,
  authCodeSent,
  authCode,
  setAuthCode,
  authPassword,
  setAuthPassword,
  authSession,
  authIdentity,
  sendingCode,
  verifyingCode,
  onInitStepNext,
  onBackToStepOne,
  onSendLoginCode,
  onVerifyLogin,
  onInitConfig,
  onTestProxy,
}: InitPageProps) {
  const { t } = useTranslation()

  return (
    <Card className="overflow-hidden border-border/60 bg-card/60 shadow-md backdrop-blur-md transition-all">
      <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
        <CardTitle className="text-2xl font-semibold tracking-tight">{t("init.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("init.description")}</p>
        <Badge variant="outline">{t("init.subtitle", { step: initStep })}</Badge>

        {initStep === 1 ? (
          <>
            <Card>
              <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {t("init.step1.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ConfigFields
                  form={form}
                  setForm={setForm}
                  allowedUserIdsInput={allowedUserIdsInput}
                  setAllowedUserIdsInput={setAllowedUserIdsInput}
                  mediaTypes={mediaTypes}
                  toggleMediaType={toggleMediaType}
                  testingProxy={testingProxy}
                  onTestProxy={onTestProxy}
                />
                {canProceedInitStepOne ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("init.step1.description")}
                  </p>
                ) : (
                  <p className="text-xs text-red-600">
                    {t("init.step1.error", { error: initStepOneIssues[0] })}
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button disabled={loading || !canProceedInitStepOne} onClick={onInitStepNext}>
                {t("init.step1.next")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {t("init.step2.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="auth-phone">{t("init.step2.phone_label")}</Label>
                  <Input
                    id="auth-phone"
                    value={authPhoneNumber}
                    onChange={event => setAuthPhoneNumber(event.target.value)}
                    placeholder={t("init.step2.phone_placeholder")}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={sendingCode || verifyingCode || loading}
                    onClick={onSendLoginCode}
                  >
                    {sendingCode ? t("init.step2.sending_code") : t("init.step2.send_code")}
                  </Button>
                </div>

                {authCodeSent ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
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
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={sendingCode || verifyingCode || loading}
                        onClick={onVerifyLogin}
                      >
                        {verifyingCode
                          ? t("init.step2.verifying_code")
                          : t("init.step2.verify_code")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("init.step2.hint")}
                  </p>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {authSession
                    ? `${t("init.step2.authenticated")}${authIdentity ? `：${authIdentity}` : ""}`
                    : t("init.step2.unauthenticated")}
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="secondary"
                disabled={savingConfig || loading}
                onClick={onBackToStepOne}
              >
                {t("init.back")}
              </Button>
              <Button disabled={savingConfig || loading || !authSession} onClick={onInitConfig}>
                <Save className="mr-2 h-4 w-4" />
                {savingConfig ? t("init.submitting") : t("init.submit")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
