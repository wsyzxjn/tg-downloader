import { Save } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfigFields } from "@/components/app/config-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAppFlow, useAppUi } from "@/context/app-context"

export function InitPage() {
  const { t } = useTranslation()
  const { initFlow } = useAppFlow()
  const { loading } = useAppUi()

  return (
    <Card className="overflow-hidden border-border/60 bg-card/60 shadow-md backdrop-blur-md transition-all">
      <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
        <CardTitle className="text-2xl font-semibold tracking-tight">{t("init.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("init.description")}</p>
        <Badge variant="outline">{t("init.subtitle", { step: initFlow.initStep })}</Badge>

        {initFlow.initStep === 1 ? (
          <>
            <Card>
              <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {t("init.step1.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="web-username">
                      {t("config.web_username")}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="web-username"
                      value={initFlow.form.webUsername}
                      onChange={event =>
                        initFlow.setForm(prev => ({ ...prev, webUsername: event.target.value }))
                      }
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
                      value={initFlow.form.webPassword}
                      onChange={event =>
                        initFlow.setForm(prev => ({ ...prev, webPassword: event.target.value }))
                      }
                      placeholder={t("config.web_password_placeholder")}
                    />
                  </div>
                </div>
                <ConfigFields />
                {initFlow.canProceedInitStepOne ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("init.step1.description")}
                  </p>
                ) : (
                  <p className="text-xs text-red-600">
                    {t("init.step1.error", { error: initFlow.initStepOneIssues[0] })}
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button
                disabled={loading || !initFlow.canProceedInitStepOne}
                onClick={initFlow.handleInitStepNext}
              >
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
                    value={initFlow.authPhoneNumber}
                    onChange={event => initFlow.setAuthPhoneNumber(event.target.value)}
                    placeholder={t("init.step2.phone_placeholder")}
                  />
                </div>

                {initFlow.authCodeSent ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="auth-code">{t("init.step2.code_label")}</Label>
                      <Input
                        id="auth-code"
                        value={initFlow.authCode}
                        onChange={event => initFlow.setAuthCode(event.target.value)}
                        placeholder={t("init.step2.code_placeholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="auth-password">{t("init.step2.password_label")}</Label>
                      <Input
                        id="auth-password"
                        type="password"
                        value={initFlow.authPassword}
                        onChange={event => initFlow.setAuthPassword(event.target.value)}
                        placeholder={t("init.step2.password_placeholder")}
                      />
                    </div>
                  </>
                ) : null}

                {initFlow.authIdentity ? (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {t("init.step2.authenticated_as", { identity: initFlow.authIdentity })}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={() => initFlow.setInitStep(1)}>
                {t("init.step2.back")}
              </Button>
              <div className="flex flex-wrap gap-2">
                {!initFlow.authCodeSent ? (
                  <Button
                    disabled={loading || initFlow.sendingCode}
                    onClick={() => void initFlow.handleSendLoginCode()}
                  >
                    {initFlow.sendingCode ? t("init.step2.sending") : t("init.step2.send_code")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={loading || initFlow.verifyingCode}
                    onClick={() => void initFlow.handleVerifyLogin()}
                  >
                    {initFlow.verifyingCode ? t("init.step2.verifying") : t("init.step2.verify")}
                  </Button>
                )}
                <Button
                  disabled={loading || initFlow.savingConfig || !initFlow.authSession}
                  onClick={() => void initFlow.handleInitConfig()}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {initFlow.savingConfig ? t("init.step2.initializing") : t("init.step2.finish")}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
