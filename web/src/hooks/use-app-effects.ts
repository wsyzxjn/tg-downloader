import { useEffect } from "react"
import type { TaskRecord } from "@/types/app"

interface UseInitialLoadParams {
  isInitRoute: boolean
  loadConfig: () => Promise<void>
  loadTasks: () => Promise<void>
  setLoading: (loading: boolean) => void
  onLoadError: (message: string) => void
}

export function useInitialLoad({
  isInitRoute,
  loadConfig,
  loadTasks,
  setLoading,
  onLoadError,
}: UseInitialLoadParams) {
  useEffect(() => {
    let unmounted = false

    const initialize = async () => {
      try {
        setLoading(true)
        if (isInitRoute) {
          await loadConfig()
        } else {
          await Promise.all([loadConfig(), loadTasks()])
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
  }, [isInitRoute, loadConfig, loadTasks, onLoadError, setLoading])
}

interface UseRouteGuardParams {
  configured: boolean | null
  isInitRoute: boolean
  navigateTo: (path: "/" | "/init") => void
}

export function useRouteGuard({ configured, isInitRoute, navigateTo }: UseRouteGuardParams) {
  useEffect(() => {
    if (configured === null) {
      return
    }

    if (!configured && !isInitRoute) {
      navigateTo("/init")
      return
    }

    if (configured && isInitRoute) {
      navigateTo("/")
    }
  }, [configured, isInitRoute, navigateTo])
}

interface UseTaskPollingParams {
  isInitRoute: boolean
  configured: boolean | null
  loadTasks: () => Promise<void>
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

export function useTaskPolling({
  isInitRoute,
  configured,
  loadTasks,
  replaceTasks,
  upsertTask,
  removeTask,
}: UseTaskPollingParams) {
  useEffect(() => {
    if (isInitRoute || !configured) {
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
  }, [configured, isInitRoute, loadTasks, removeTask, replaceTasks, upsertTask])
}
