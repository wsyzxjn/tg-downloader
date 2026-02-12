import { FolderOpen, Save, Settings } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfigFields } from "@/components/app/config-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppFlow, useAppUi } from "@/context/app-context"

export function SettingsPage() {
  const { t } = useTranslation()
  const { initFlow } = useAppFlow()
  const { loading } = useAppUi()

  return (
    <Card className="overflow-hidden border-border/60 bg-card/60 shadow-md backdrop-blur-md transition-all">
      <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Settings className="h-5 w-5 text-primary" />
          {t("settings.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <ConfigFields />
        <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-background/50 p-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span>{t("settings.current_download_dir")}:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
              {initFlow.form.downloadDir || "-"}
            </code>
          </div>
          <Button
            disabled={initFlow.savingConfig || loading}
            onClick={() => void initFlow.handleSaveConfig()}
            className="w-full sm:w-auto shadow-sm"
          >
            {initFlow.savingConfig ? (
              <>
                <Save className="mr-2 h-4 w-4 animate-pulse" />
                {t("settings.saving")}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t("settings.save")}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
