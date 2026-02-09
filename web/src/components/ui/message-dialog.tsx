import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

interface MessageDialogProps {
  open: boolean
  title?: string
  message: string
  onClose: () => void
}

export function MessageDialog({ open, title, message, onClose }: MessageDialogProps) {
  const { t } = useTranslation()
  const displayTitle = title || t("modal.title", "提示")

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg sm:rounded-2xl">
        <h3 className="text-base font-semibold text-foreground">{displayTitle}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>{t("modal.close")}</Button>
        </div>
      </div>
    </div>
  )
}
