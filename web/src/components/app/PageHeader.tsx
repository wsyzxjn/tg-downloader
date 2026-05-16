import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
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
    <div className="flex flex-col gap-2 border-b border-border/60 pb-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>{configured ? t("header.initialized") : t("header.uninitialized")}</p>
      {!onInitRoute && onTaskRoute ? (
        <p>{t("header.active_tasks", { count: activeTaskCount })}</p>
      ) : null}
    </div>
  )
}
