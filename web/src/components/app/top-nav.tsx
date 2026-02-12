import { LayoutDashboard, Settings2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { NavLink } from "react-router-dom"
import { useAppRoute, useAppTheme } from "@/context/app-context"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "./language-switcher"
import { ThemeSwitcher } from "./theme-switcher"

export function TopNav() {
  const { t } = useTranslation()
  const { isPublicRoute } = useAppRoute()
  const { setThemeMode, themeMode } = useAppTheme()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="Logo" className="h-8 w-8" />
          <p className="hidden text-lg font-bold tracking-tight md:block">{t("title")}</p>
        </div>

        {!isPublicRoute ? (
          <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/50 p-1 shadow-sm backdrop-blur-sm">
            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground"
                )
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>{t("nav.tasks")}</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground"
                )
              }
            >
              <Settings2 className="h-4 w-4" />
              <span>{t("nav.settings")}</span>
            </NavLink>
          </nav>
        ) : null}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />
        </div>
      </div>
    </header>
  )
}
