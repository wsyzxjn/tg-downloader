import i18n from "@/i18n"
import { useUiStore } from "./uiStore"

export const t = i18n.t.bind(i18n)

export function notify(message: string) {
  useUiStore.getState().setNotice(message)
}

export function getErrorMessage(error: unknown, fallbackKey: string) {
  return error instanceof Error ? error.message : t(fallbackKey)
}
