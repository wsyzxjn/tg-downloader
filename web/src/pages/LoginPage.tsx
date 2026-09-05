import { Key, Lock, LogIn, User } from "lucide-react"
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-8">
      <AppSectionCard
        title={t("login.title")}
        className="w-full max-w-md shadow-sm border-border/70"
        headerClassName="text-center pt-6 pb-2"
        titleClassName="text-lg font-semibold tracking-tight"
        contentClassName="pt-4 pb-6"
      >
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault()
            void login()
          }}
        >
          <div className="flex justify-center pb-2">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Lock className="h-6 w-6" />
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground pb-1">{t("login.description")}</p>

          <div className="space-y-1.5">
            <Label htmlFor="web-login-username" className="text-xs font-medium text-foreground">
              {t("login.username")}
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
              <Input
                id="web-login-username"
                value={loginUsername}
                onChange={event => setLoginUsername(event.target.value)}
                autoComplete="username"
                placeholder={t("login.username_placeholder")}
                className="pl-9 h-10 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="web-login-password" className="text-xs font-medium text-foreground">
              {t("login.password")}
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Key className="h-4 w-4" />
              </div>
              <Input
                id="web-login-password"
                type="password"
                value={loginPassword}
                onChange={event => setLoginPassword(event.target.value)}
                autoComplete="current-password"
                placeholder={t("login.password_placeholder")}
                className="pl-9 h-10 text-sm"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-10 font-medium mt-2"
            disabled={bootstrapping || loggingIn || !loginUsername.trim() || !loginPassword.trim()}
          >
            <LogIn className="h-4 w-4 mr-1.5" />
            <span>{bootstrapping || loggingIn ? t("login.submitting") : t("login.submit")}</span>
          </Button>
        </form>
      </AppSectionCard>
    </div>
  )
}
