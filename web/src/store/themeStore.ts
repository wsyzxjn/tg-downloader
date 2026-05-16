import { create } from "zustand"
import type { ThemeMode } from "@/types/app"

function getStoredThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem("tg-download-theme")
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored
  }

  return "system"
}

function getSystemDarkPreference(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

interface ThemeStore {
  themeMode: ThemeMode
  systemDark: boolean
  setThemeMode: (themeMode: ThemeMode) => void
  setSystemDark: (systemDark: boolean) => void
}

export function selectIsDarkTheme(state: Pick<ThemeStore, "themeMode" | "systemDark">) {
  return state.themeMode === "dark" || (state.themeMode === "system" && state.systemDark)
}

export const useThemeStore = create<ThemeStore>(set => ({
  themeMode: getStoredThemeMode(),
  systemDark: getSystemDarkPreference(),
  setThemeMode: themeMode => {
    set({ themeMode })
  },
  setSystemDark: systemDark => {
    set({ systemDark })
  },
}))
