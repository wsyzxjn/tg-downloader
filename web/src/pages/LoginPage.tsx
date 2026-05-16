import { useTranslation } from "react-i18next"
import { useShallow } from "zustand/react/shallow"
import { AppSectionCard } from "@/components/app/AppSectionCard"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { useAuthStore } from "@/store/authStore"
import { useUiStore } from "@/store/uiStore"

export function LoginPage() {
  const { t } = useTranslation()
  const { login, loggingIn, loginPassword, loginUsername, setLoginPassword, setLoginUsername } =
    useAuthStore(
      useShallow(state => ({
        login: state.login,
        loggingIn: state.loggingIn,
        loginPassword: state.loginPassword,
        loginUsername: state.loginUsername,
        setLoginPassword: state.setLoginPassword,
        setLoginUsername: state.setLoginUsername,
      }))
    )
  const bootstrapping = useUiStore(state => state.bootstrapping)

  return (
    <AppSectionCard
      title={t("login.title")}
      className="mx-auto w-full max-w-md"
      titleClassName="text-lg font-semibold tracking-tight"
      contentClassName="pt-6"
    >
      <form
        className="space-y-4"
        onSubmit={event => {
          event.preventDefault()
          void login()
        }}
      >
        <p className="text-sm text-muted-foreground">{t("login.description")}</p>
        <div className="space-y-2">
          <Label htmlFor="web-login-username">{t("login.username")}</Label>
          <Input
            id="web-login-username"
            value={loginUsername}
            onChange={event => setLoginUsername(event.target.value)}
            autoComplete="username"
            placeholder={t("login.username_placeholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="web-login-password">{t("login.password")}</Label>
          <Input
            id="web-login-password"
            type="password"
            value={loginPassword}
            onChange={event => setLoginPassword(event.target.value)}
            autoComplete="current-password"
            placeholder={t("login.password_placeholder")}
          />
        </div>
        <Button type="submit" className="w-full" disabled={bootstrapping || loggingIn}>
          {bootstrapping || loggingIn ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>
    </AppSectionCard>
  )
}
