import { ListTodo, Settings } from "lucide-react"
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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md transition-colors">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3 sm:py-3.5">
        <div className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="Logo" className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
          <p className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
            {t("title")}
          </p>
        </div>

        {!hideAppNav ? (
          <nav className="flex items-center gap-1 sm:gap-2 text-sm">
            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )
              }
            >
              <ListTodo className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{t("nav.tasks")}</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )
              }
            >
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{t("nav.settings")}</span>
            </NavLink>
          </nav>
        ) : (
          <div className="flex-1" />
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />
        </div>
      </div>
    </header>
  )
}
