import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { cancelTask, createLinkTask, fetchTasks } from "@/services/api"
import type { TaskRecord } from "@/types/app"

interface UseTaskActionsParams {
  configured: boolean | null
  onNotice: (message: string) => void
}

interface UseTaskActionsResult {
  tasks: TaskRecord[]
  activeTaskCount: number
  linkInput: string
  setLinkInput: (value: string) => void
  creatingTask: boolean
  cancelingTaskId: string | null
  loadTasks: () => Promise<void>
  replaceTasks: (nextTasks: TaskRecord[]) => void
  upsertTask: (task: TaskRecord) => void
  removeTask: (taskId: string) => void
  handleCreateTask: () => Promise<void>
  handleCancelTask: (taskId: string) => Promise<void>
}

export function useTaskActions({
  configured,
  onNotice,
}: UseTaskActionsParams): UseTaskActionsResult {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [linkInput, setLinkInput] = useState("")
  const [creatingTask, setCreatingTask] = useState(false)
  const [cancelingTaskId, setCancelingTaskId] = useState<string | null>(null)

  const activeTaskCount = useMemo(
    () => tasks.filter(task => task.status === "pending" || task.status === "running").length,
    [tasks]
  )

  const sortTasks = useCallback((taskList: TaskRecord[]) => {
    return [...taskList].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [])

  const replaceTasks = useCallback(
    (nextTasks: TaskRecord[]) => {
      setTasks(sortTasks(nextTasks))
    },
    [sortTasks]
  )

  const upsertTask = useCallback(
    (task: TaskRecord) => {
      setTasks(prev => {
        const next = prev.filter(item => item.id !== task.id)
        next.push(task)
        return sortTasks(next)
      })
    },
    [sortTasks]
  )

  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(item => item.id !== taskId))
  }, [])

  const loadTasks = useCallback(async () => {
    const list = await fetchTasks()
    replaceTasks(list || [])
  }, [replaceTasks])

  const handleCreateTask = useCallback(async () => {
    if (!configured) {
      onNotice(t("messages.not_configured"))
      return
    }

    const messageLink = linkInput.trim()
    if (!messageLink) {
      onNotice(t("messages.enter_link"))
      return
    }

    setCreatingTask(true)
    try {
      const task = await createLinkTask(messageLink)
      setLinkInput("")
      onNotice(t("messages.task_created", { id: task.id }))
      await loadTasks()
    } catch (error) {
      onNotice(error instanceof Error ? error.message : t("messages.create_task_failed"))
    } finally {
      setCreatingTask(false)
    }
  }, [configured, linkInput, loadTasks, onNotice, t])

  const handleCancelTask = useCallback(
    async (taskId: string) => {
      setCancelingTaskId(taskId)
      try {
        await cancelTask(taskId)
        // onNotice(t("messages.task_canceled", { id: taskId }))
      } catch (error) {
        onNotice(error instanceof Error ? error.message : t("messages.cancel_task_failed"))
      } finally {
        setCancelingTaskId(null)
      }
    },
    [onNotice, t]
  )

  return useMemo(
    () => ({
      tasks,
      activeTaskCount,
      linkInput,
      setLinkInput,
      creatingTask,
      cancelingTaskId,
      loadTasks,
      replaceTasks,
      upsertTask,
      removeTask,
      handleCreateTask,
      handleCancelTask,
    }),
    [
      activeTaskCount,
      cancelingTaskId,
      creatingTask,
      handleCancelTask,
      handleCreateTask,
      linkInput,
      loadTasks,
      removeTask,
      replaceTasks,
      tasks,
      upsertTask,
    ]
  )
}
