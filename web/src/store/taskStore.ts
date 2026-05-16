import { create } from "zustand"
import { cancelTask as cancelTaskRequest, createLinkTask, fetchTasks } from "@/services/api"
import type { TaskRecord } from "@/types/app"
import { useAuthStore } from "./authStore"
import { getErrorMessage, notify, t } from "./storeUtils"

function sortTasks(tasks: TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

interface TaskStore {
  tasks: TaskRecord[]
  linkInput: string
  creatingTask: boolean
  cancelingTaskId: string | null
  setLinkInput: (linkInput: string) => void
  loadTasks: () => Promise<void>
  applyTaskSnapshot: (tasks: TaskRecord[]) => void
  upsertTask: (task: TaskRecord) => void
  removeTask: (taskId: string) => void
  createTask: () => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
}

export function selectActiveTaskCount(state: Pick<TaskStore, "tasks">) {
  return state.tasks.filter(task => task.status === "pending" || task.status === "running").length
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  linkInput: "",
  creatingTask: false,
  cancelingTaskId: null,
  setLinkInput: linkInput => {
    set({ linkInput })
  },
  loadTasks: async () => {
    const tasks = await fetchTasks()
    get().applyTaskSnapshot(tasks)
  },
  applyTaskSnapshot: tasks => {
    set({ tasks: sortTasks(tasks) })
  },
  upsertTask: task => {
    set(state => {
      const nextTasks = state.tasks.filter(item => item.id !== task.id)
      nextTasks.push(task)
      return {
        tasks: sortTasks(nextTasks),
      }
    })
  },
  removeTask: taskId => {
    set(state => ({
      tasks: state.tasks.filter(task => task.id !== taskId),
    }))
  },
  createTask: async () => {
    if (!useAuthStore.getState().configured) {
      notify(t("messages.not_configured"))
      return
    }

    const messageLink = get().linkInput.trim()
    if (!messageLink) {
      notify(t("messages.enter_link"))
      return
    }

    set({ creatingTask: true })
    try {
      const task = await createLinkTask(messageLink)
      set({ linkInput: "" })
      notify(t("messages.task_created", { id: task.id }))
      await get().loadTasks()
    } catch (error) {
      notify(getErrorMessage(error, "messages.create_task_failed"))
    } finally {
      set({ creatingTask: false })
    }
  },
  cancelTask: async taskId => {
    set({ cancelingTaskId: taskId })
    try {
      await cancelTaskRequest(taskId)
    } catch (error) {
      notify(getErrorMessage(error, "messages.cancel_task_failed"))
    } finally {
      set({ cancelingTaskId: null })
    }
  },
}))
