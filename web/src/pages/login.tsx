import { KeyRound, LogIn } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LoginPageProps {
  loading: boolean
  username: string
  password: string
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onLogin: () => void
}

export function LoginPage({
  loading,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onLogin,
}: LoginPageProps) {
  const { t } = useTranslation()

  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden border-border/60 bg-card/60 shadow-md backdrop-blur-md transition-all">
      <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <KeyRound className="h-5 w-5 text-primary" />
          {t("login.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <p className="text-sm text-muted-foreground">{t("login.description")}</p>
        <div className="space-y-2">
          <Label htmlFor="web-login-username">{t("login.username")}</Label>
          <Input
            id="web-login-username"
            value={username}
            onChange={event => onUsernameChange(event.target.value)}
            autoComplete="username"
            placeholder={t("login.username_placeholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="web-login-password">{t("login.password")}</Label>
          <Input
            id="web-login-password"
            type="password"
            value={password}
            onChange={event => onPasswordChange(event.target.value)}
            autoComplete="current-password"
            placeholder={t("login.password_placeholder")}
          />
        </div>
        <Button className="w-full" disabled={loading} onClick={onLogin}>
          <LogIn className="mr-2 h-4 w-4" />
          {loading ? t("login.submitting") : t("login.submit")}
        </Button>
      </CardContent>
    </Card>
  )
}
