import { CheckCircle2, CircleDashed, Clock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import { Badge } from "@/components/ui/Badge"
import { useAuthStore } from "@/store/authStore"
import { selectActiveTaskCount, useTaskStore } from "@/store/taskStore"
import { isInitRoute, isTaskRoute } from "@/utils/routes"

export function PageHeader() {
  const { t } = useTranslation()
  const pathname = useLocation().pathname
  const configured = useAuthStore(state => state.configured)
  const activeTaskCount = useTaskStore(selectActiveTaskCount)
  const onInitRoute = isInitRoute(pathname)
  const onTaskRoute = isTaskRoute(pathname)

  return (
    <div className="flex flex-col gap-2 border-b border-border/50 pb-3 text-xs sm:text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {configured ? (
          <span className="flex items-center gap-1.5 font-medium text-foreground/85">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>{t("header.initialized")}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-500">
            <CircleDashed className="h-4 w-4 animate-spin" />
            <span>{t("header.uninitialized")}</span>
          </span>
        )}
      </div>

      {!onInitRoute && onTaskRoute ? (
        <div className="flex items-center gap-2">
          {activeTaskCount > 0 ? (
            <Badge variant="info" className="flex items-center gap-1.5 py-0.5 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
              </span>
              <span>{t("header.active_tasks", { count: activeTaskCount })}</span>
            </Badge>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/75">
              <Clock className="h-3.5 w-3.5" />
              <span>{t("header.active_tasks", { count: 0 })}</span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}
