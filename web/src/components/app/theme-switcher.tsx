import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { ThemeMode } from "@/types/app"

interface ThemeSwitcherProps {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

function getNextThemeMode(current: ThemeMode): ThemeMode {
  if (current === "system") {
    return "light"
  }
  if (current === "light") {
    return "dark"
  }
  return "system"
}

export function ThemeSwitcher({ themeMode, setThemeMode }: ThemeSwitcherProps) {
  const { t } = useTranslation()
  const Icon = themeMode === "system" ? Monitor : themeMode === "light" ? Sun : Moon

  const label =
    themeMode === "system"
      ? t("theme.system")
      : themeMode === "light"
        ? t("theme.light")
        : t("theme.dark")

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 gap-1 px-3 text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => setThemeMode(getNextThemeMode(themeMode))}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  )
}
