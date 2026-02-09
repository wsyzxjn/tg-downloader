import { useEffect, useState } from "react"
import type { ThemeMode } from "@/types/app"

interface UseThemeModeResult {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

export function useThemeMode(): UseThemeModeResult {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem("tg-download-theme")
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored
    }
    return "system"
  })

  const [systemDark, setSystemDark] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  )

  const isDarkTheme = themeMode === "dark" || (themeMode === "system" && systemDark)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const listener = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches)
    }

    mediaQuery.addEventListener("change", listener)
    return () => {
      mediaQuery.removeEventListener("change", listener)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem("tg-download-theme", themeMode)
  }, [themeMode])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme)
  }, [isDarkTheme])

  return {
    themeMode,
    setThemeMode,
  }
}
