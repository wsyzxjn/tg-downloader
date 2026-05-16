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
    <AppSectionCard title={t("settings.title")} contentClassName="space-y-6 pt-6">
      <ConfigFields />
      <div className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{t("settings.current_download_dir")}</p>
          <code className="font-mono text-xs text-foreground">{downloadDir || "-"}</code>
        </div>
        <Button
          disabled={savingConfig || bootstrapping}
          onClick={() => void saveSettings()}
          className="w-full sm:w-auto"
        >
          {savingConfig ? t("settings.saving") : t("settings.save")}
        </Button>
      </div>
    </AppSectionCard>
  )
}
