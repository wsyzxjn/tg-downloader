import { RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface PageHeaderProps {
  configured: boolean | null
  isInitRoute: boolean
  isTaskRoute: boolean
  activeTaskCount: number
  onRefreshTasks: () => void
}

export function PageHeader({
  configured,
  isInitRoute,
  isTaskRoute,
  activeTaskCount,
  onRefreshTasks,
}: PageHeaderProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={configured ? "default" : "secondary"}>
              {configured ? t("header.initialized") : t("header.uninitialized")}
            </Badge>
            {!isInitRoute ? (
              <Badge variant="outline">
                {t("header.active_tasks", { count: activeTaskCount })}
              </Badge>
            ) : null}
          </div>
          {configured && isTaskRoute ? (
            <Button variant="secondary" onClick={onRefreshTasks}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("header.refresh")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
