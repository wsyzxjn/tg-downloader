import { useEffect } from "react"
import type { TaskRecord } from "@/types/app"

interface UseAppRuntimeParams {
  isInitRoute: boolean
  isLoginRoute: boolean
  configured: boolean | null
  authConfigured: boolean | null
  authenticated: boolean | null
  loadAuthStatus: () => Promise<{
    configured: boolean
    authConfigured: boolean
    authenticated: boolean
  }>
  loadConfig: () => Promise<void>
  loadTasks: () => Promise<void>
  setLoading: (loading: boolean) => void
  onLoadError: (message: string) => void
  navigateTo: (path: "/tasks" | "/init" | "/login") => void
  replaceTasks: (tasks: TaskRecord[]) => void
  upsertTask: (task: TaskRecord) => void
  removeTask: (taskId: string) => void
}

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

export function useAppRuntime({
  isInitRoute,
  isLoginRoute,
  configured,
  authConfigured,
  authenticated,
  loadAuthStatus,
  loadConfig,
  loadTasks,
  setLoading,
  onLoadError,
  navigateTo,
  replaceTasks,
  upsertTask,
  removeTask,
}: UseAppRuntimeParams) {
  useEffect(() => {
    let unmounted = false

    const initialize = async () => {
      try {
        setLoading(true)
        const status = await loadAuthStatus()
        if (status.configured && status.authConfigured && !status.authenticated) {
          return
        }
        if (isInitRoute) {
          await loadConfig()
        } else if (!isLoginRoute) {
          await Promise.all([loadConfig(), loadTasks()])
        } else {
          await loadConfig()
        }
      } catch {
        if (!unmounted) {
          onLoadError("加载失败，请确认后端已启动")
        }
      } finally {
        if (!unmounted) {
          setLoading(false)
        }
      }
    }

    void initialize()

    return () => {
      unmounted = true
    }
  }, [isInitRoute, isLoginRoute, loadAuthStatus, loadConfig, loadTasks, onLoadError, setLoading])

  useEffect(() => {
    if (configured === null || authConfigured === null || authenticated === null) {
      return
    }

    if (!configured && !isInitRoute) {
      navigateTo("/init")
      return
    }

    if (!configured) {
      return
    }

    if (authConfigured && !authenticated && !isLoginRoute) {
      navigateTo("/login")
      return
    }

    if (authConfigured && !authenticated) {
      return
    }

    if (isLoginRoute || isInitRoute) {
      navigateTo("/tasks")
    }
  }, [authenticated, authConfigured, configured, isInitRoute, isLoginRoute, navigateTo])

  useEffect(() => {
    if (isInitRoute || isLoginRoute || !configured || !authenticated) {
      return
    }

    if (typeof EventSource === "undefined") {
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
        if (!parsed?.tasks) {
          return
        }
        replaceTasks(parsed.tasks)
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
  }, [
    authenticated,
    configured,
    isInitRoute,
    isLoginRoute,
    loadTasks,
    removeTask,
    replaceTasks,
    upsertTask,
  ])
}
