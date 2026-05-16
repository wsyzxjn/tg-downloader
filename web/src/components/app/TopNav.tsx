import { useTranslation } from "react-i18next"
import { NavLink, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useThemeStore } from "@/store/themeStore"
import { isPublicRoute } from "@/utils/routes"
import { LanguageSwitcher } from "./LanguageSwitcher"
import { ThemeSwitcher } from "./ThemeSwitcher"

export function TopNav() {
  const { t } = useTranslation()
  const pathname = useLocation().pathname
  const themeMode = useThemeStore(state => state.themeMode)
  const setThemeMode = useThemeStore(state => state.setThemeMode)
  const hideAppNav = isPublicRoute(pathname)

  return (
    <header className="border-b border-border/60 bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-4">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="Logo" className="h-7 w-7" />
          <p className="text-base font-semibold tracking-tight">{t("title")}</p>
        </div>

        {!hideAppNav ? (
          <nav className="flex items-center gap-6 text-sm">
            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                cn(
                  "border-b border-transparent pb-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
                  isActive ? "border-foreground text-foreground" : ""
                )
              }
            >
              <span>{t("nav.tasks")}</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "border-b border-transparent pb-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
                  isActive ? "border-foreground text-foreground" : ""
                )
              }
            >
              <span>{t("nav.settings")}</span>
            </NavLink>
          </nav>
        ) : (
          <div className="flex-1" />
        )}
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />
        </div>
      </div>
    </header>
  )
}
