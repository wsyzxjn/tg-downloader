import { RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAppFlow, useAppRoute } from "@/context/app-context"

export function PageHeader() {
  const { t } = useTranslation()
  const { initFlow, taskActions } = useAppFlow()
  const { isInitRoute, isTaskRoute } = useAppRoute()

  return (
    <Card className="overflow-hidden border-border/60 bg-card/60 shadow-md backdrop-blur-md transition-all">
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-h-[2.25rem]">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={initFlow.configured ? "default" : "secondary"}>
              {initFlow.configured ? t("header.initialized") : t("header.uninitialized")}
            </Badge>
            {!isInitRoute ? (
              <Badge variant="outline">
                {t("header.active_tasks", { count: taskActions.activeTaskCount })}
              </Badge>
            ) : null}
          </div>
          {initFlow.configured && isTaskRoute ? (
            <Button variant="outline" onClick={() => void taskActions.loadTasks()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("header.refresh")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
