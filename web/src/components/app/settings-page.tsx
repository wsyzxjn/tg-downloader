import { FolderOpen, Save, Settings } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { ConfigFields } from "@/components/app/config-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SettingForm } from "@/types/app"

interface SettingsPageProps {
  loading: boolean
  savingConfig: boolean
  form: SettingForm
  setForm: Dispatch<SetStateAction<SettingForm>>
  allowedUserIdsInput: string
  setAllowedUserIdsInput: Dispatch<SetStateAction<string>>
  mediaTypes: string[]
  toggleMediaType: (mediaType: string) => void
  testingProxy: boolean
  onSaveConfig: () => void
  onTestProxy: () => void
}

export function SettingsPage({
  loading,
  savingConfig,
  form,
  setForm,
  allowedUserIdsInput,
  setAllowedUserIdsInput,
  mediaTypes,
  toggleMediaType,
  testingProxy,
  onSaveConfig,
  onTestProxy,
}: SettingsPageProps) {
  const { t } = useTranslation()

  return (
    <Card className="overflow-hidden border-border/40 bg-card/50 shadow-sm backdrop-blur-sm transition-all hover:border-border/80 hover:shadow-md">
      <CardHeader className="bg-muted/40 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Settings className="h-5 w-5 text-primary" />
          {t("settings.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <ConfigFields
          form={form}
          setForm={setForm}
          allowedUserIdsInput={allowedUserIdsInput}
          setAllowedUserIdsInput={setAllowedUserIdsInput}
          mediaTypes={mediaTypes}
          toggleMediaType={toggleMediaType}
          testingProxy={testingProxy}
          onTestProxy={onTestProxy}
        />
        <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-background/50 p-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span>{t("settings.current_download_dir")}:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
              {form.downloadDir || "-"}
            </code>
          </div>
          <Button
            disabled={savingConfig || loading}
            onClick={onSaveConfig}
            className="w-full sm:w-auto shadow-sm"
          >
            {savingConfig ? (
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
