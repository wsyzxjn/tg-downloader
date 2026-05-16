import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useShallow } from "zustand/react/shallow"
import { useAuthStore } from "@/store/authStore"
import { useConfigStore } from "@/store/configStore"
import { useTaskStore } from "@/store/taskStore"
import { selectIsDarkTheme, useThemeStore } from "@/store/themeStore"
import { useUiStore } from "@/store/uiStore"
import type { TaskRecord } from "@/types/app"
import { getGuardRedirect, isInitRoute, isPublicRoute } from "@/utils/routes"

interface TaskStreamSnapshotEvent {
  tasks: TaskRecord[]
}

interface TaskStreamUpdateEvent {
  type: "upsert" | "remove"
  taskId: string
  task?: TaskRecord
}

function parseSseEventData<T>(event: MessageEvent<string>): T | null {
  try {
    return JSON.parse(event.data) as T
  } catch {
    return null
  }
}

export function AppLifecycle() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname

  const { authConfigured, authenticated, configured, loadAuthStatus } = useAuthStore(
    useShallow(state => ({
      authConfigured: state.authConfigured,
      authenticated: state.authenticated,
      configured: state.configured,
      loadAuthStatus: state.loadAuthStatus,
    }))
  )
  const loadConfig = useConfigStore(state => state.loadConfig)
  const { applyTaskSnapshot, loadTasks, removeTask, upsertTask } = useTaskStore(
    useShallow(state => ({
      applyTaskSnapshot: state.applyTaskSnapshot,
      loadTasks: state.loadTasks,
      removeTask: state.removeTask,
      upsertTask: state.upsertTask,
    }))
  )
  const { setSystemDark, themeMode } = useThemeStore(
    useShallow(state => ({
      setSystemDark: state.setSystemDark,
      themeMode: state.themeMode,
    }))
  )
  const { setBootstrapping, setNotice } = useUiStore(
    useShallow(state => ({
      setBootstrapping: state.setBootstrapping,
      setNotice: state.setNotice,
    }))
  )
  const isDarkTheme = useThemeStore(selectIsDarkTheme)
  const canStreamTasks = Boolean(configured && (!authConfigured || authenticated))

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches)
    }

    setSystemDark(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [setSystemDark])

  useEffect(() => {
    window.localStorage.setItem("tg-download-theme", themeMode)
    document.documentElement.classList.toggle("dark", isDarkTheme)
  }, [isDarkTheme, themeMode])

  useEffect(() => {
    let disposed = false

    const bootstrap = async () => {
      try {
        setBootstrapping(true)
        const status = await loadAuthStatus()
        if (disposed) {
          return
        }

        if (status.configured && status.authConfigured && !status.authenticated) {
          return
        }

        if (isInitRoute(pathname)) {
          await loadConfig()
          return
        }

        if (!isPublicRoute(pathname)) {
          await Promise.all([loadConfig(), loadTasks()])
        }
      } catch {
        if (!disposed) {
          setNotice("加载失败，请确认后端已启动")
        }
      } finally {
        if (!disposed) {
          setBootstrapping(false)
        }
      }
    }

    void bootstrap()

    return () => {
      disposed = true
    }
  }, [loadAuthStatus, loadConfig, loadTasks, pathname, setBootstrapping, setNotice])

  useEffect(() => {
    const redirect = getGuardRedirect(pathname, configured, authConfigured, authenticated)
    if (redirect && redirect !== pathname) {
      navigate(redirect, { replace: true })
    }
  }, [authConfigured, authenticated, configured, navigate, pathname])

  useEffect(() => {
    if (isPublicRoute(pathname) || !canStreamTasks) {
      return
    }

    if (!("EventSource" in window)) {
      const timer = setInterval(() => {
        void loadTasks()
      }, 2000)

      return () => {
        clearInterval(timer)
      }
    }

    let disposed = false
    let eventSource: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const connect = () => {
      if (disposed) {
        return
      }

      eventSource = new EventSource("/api/tasks/stream")

      eventSource.addEventListener("snapshot", event => {
        const parsed = parseSseEventData<TaskStreamSnapshotEvent>(event as MessageEvent<string>)
        if (parsed?.tasks) {
          applyTaskSnapshot(parsed.tasks)
        }
      })

      eventSource.addEventListener("task_update", event => {
        const parsed = parseSseEventData<TaskStreamUpdateEvent>(event as MessageEvent<string>)
        if (!parsed) {
          return
        }

        if (parsed.type === "remove") {
          removeTask(parsed.taskId)
          return
        }

        if (parsed.type === "upsert" && parsed.task) {
          upsertTask(parsed.task)
        }
      })

      eventSource.onerror = () => {
        eventSource?.close()
        eventSource = null

        if (disposed) {
          return
        }

        void loadTasks()
        clearReconnectTimer()
        reconnectTimer = setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      disposed = true
      clearReconnectTimer()
      eventSource?.close()
    }
  }, [applyTaskSnapshot, canStreamTasks, loadTasks, pathname, removeTask, upsertTask])

  return null
}
