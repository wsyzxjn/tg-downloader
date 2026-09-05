import { HardDrive, Loader2, Save } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useShallow } from "zustand/react/shallow"
import { AppSectionCard } from "@/components/app/AppSectionCard"
import { ConfigFields } from "@/components/app/ConfigFields"
import { Button } from "@/components/ui/Button"
import { useConfigStore } from "@/store/configStore"
import { useUiStore } from "@/store/uiStore"

export function SettingsPage() {
  const { t } = useTranslation()
  const { downloadDir, saveSettings, savingConfig } = useConfigStore(
    useShallow(state => ({
      downloadDir: state.form.downloadDir,
      saveSettings: state.saveSettings,
      savingConfig: state.savingConfig,
    }))
  )
  const bootstrapping = useUiStore(state => state.bootstrapping)

  return (
    <AppSectionCard
      title={t("settings.title")}
      contentClassName="space-y-6 pt-5"
      headerClassName="pb-3 border-b border-border/40"
    >
      <ConfigFields />

      <div className="flex flex-col gap-4 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground/70" />
          <span>{t("settings.current_download_dir")}:</span>
          <code className="rounded-xs bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-foreground font-semibold">
            {downloadDir || "-"}
          </code>
        </div>
        <Button
          disabled={savingConfig || bootstrapping}
          onClick={() => void saveSettings()}
          className="w-full sm:w-auto h-10 px-5 font-medium"
        >
          {savingConfig ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              <span>{t("settings.saving")}</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" />
              <span>{t("settings.save")}</span>
            </>
          )}
        </Button>
      </div>
    </AppSectionCard>
  )
}
