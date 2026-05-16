import { useTranslation } from "react-i18next"
import { useShallow } from "zustand/react/shallow"
import { AppSectionCard } from "@/components/app/AppSectionCard"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"
import { useTaskStore } from "@/store/taskStore"
import { useUiStore } from "@/store/uiStore"
import type { TaskRecord, TaskStatus } from "@/types/app"
import { statusTone, taskTypeLabel } from "@/utils/app"

function normalizeProgressPercent(status: TaskStatus, percent: number): number {
  if (status === "completed") {
    return 100
  }

  return Math.max(0, Math.min(100, percent))
}

function formatSpeed(speedBytesPerSec: number | undefined): string {
  if (!speedBytesPerSec || speedBytesPerSec <= 0) {
    return "-"
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s"]
  let size = speedBytesPerSec
  let index = 0

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }

  const display = size >= 10 ? size.toFixed(0) : size.toFixed(1)
  return `${display} ${units[index]}`
}

function getTaskResultText(task: TaskRecord): string {
  if (task.result?.error) {
    return task.result.error
  }

  const fileNames = task.result?.fileNames?.filter(Boolean)
  if (fileNames && fileNames.length > 0) {
    return fileNames.join(" / ")
  }

  const filePaths = task.result?.filePaths?.filter(Boolean)
  if (filePaths && filePaths.length > 0) {
    return filePaths.join(" / ")
  }

  return task.result?.fileName || task.result?.filePath || "-"
}

export function TasksPage() {
  const { t } = useTranslation()
  const { cancelTask, cancelingTaskId, createTask, creatingTask, linkInput, setLinkInput, tasks } =
    useTaskStore(
      useShallow(state => ({
        cancelTask: state.cancelTask,
        cancelingTaskId: state.cancelingTaskId,
        createTask: state.createTask,
        creatingTask: state.creatingTask,
        linkInput: state.linkInput,
        setLinkInput: state.setLinkInput,
        tasks: state.tasks,
      }))
    )
  const bootstrapping = useUiStore(state => state.bootstrapping)

  return (
    <>
      <AppSectionCard title={t("tasks.create.title")} contentClassName="pt-6">
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault()
            void createTask()
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="link" className="text-sm font-medium text-muted-foreground">
                {t("tasks.create.link_label")}
              </Label>
              <Input
                id="link"
                placeholder={t("tasks.create.link_placeholder")}
                value={linkInput}
                onChange={event => setLinkInput(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={creatingTask || bootstrapping}
              className="min-w-[140px]"
            >
              {creatingTask ? t("tasks.create.creating") : t("tasks.create.button")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("tasks.create.hint")}</p>
        </form>
      </AppSectionCard>

      <AppSectionCard title={t("tasks.list.title")} contentClassName="px-0 pb-0 pt-4">
        <div className="overflow-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px] min-w-[100px]">
                  {t("tasks.list.headers.id")}
                </TableHead>
                <TableHead className="min-w-[100px]">{t("tasks.list.headers.type")}</TableHead>
                <TableHead className="min-w-[100px]">{t("tasks.list.headers.status")}</TableHead>
                <TableHead className="w-[280px] min-w-[200px]">
                  {t("tasks.list.headers.progress")} / {t("tasks.list.headers.speed")}
                </TableHead>
                <TableHead className="w-[180px] min-w-[150px]">
                  {t("tasks.list.headers.updated_at")}
                </TableHead>
                <TableHead className="min-w-[200px]">{t("tasks.list.headers.result")}</TableHead>
                <TableHead className="w-[120px] min-w-[100px]">
                  {t("tasks.list.headers.action")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => {
                const progressPercent = normalizeProgressPercent(task.status, task.progress.percent)
                const resultText = getTaskResultText(task)
                const rowClass =
                  task.status === "canceled"
                    ? "group opacity-60 transition-colors hover:bg-muted/20"
                    : "group transition-colors hover:bg-muted/20"

                return (
                  <TableRow key={task.id} className={rowClass}>
                    <TableCell className="max-w-[160px] truncate font-mono text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      {task.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap font-normal">
                        {t(`tasks.type.${task.type}` as const, taskTypeLabel(task.type))}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusTone(task.status)} className="whitespace-nowrap">
                        {t(`tasks.status.${task.status}` as const)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                          <span>{progressPercent}%</span>
                          <span>{formatSpeed(task.progress.speedBytesPerSec)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(task.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[250px] text-xs text-muted-foreground">
                      <div className="w-full truncate" title={resultText}>
                        {resultText}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      {task.status === "pending" || task.status === "running" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cancelingTaskId === task.id}
                          onClick={() => void cancelTask(task.id)}
                          className="h-7 whitespace-nowrap text-xs"
                        >
                          {cancelingTaskId === task.id
                            ? t("tasks.actions.canceling")
                            : t("tasks.actions.cancel")}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-[300px] text-center">
                    <div className="space-y-2 text-muted-foreground">
                      <p className="text-sm font-medium text-foreground">
                        {t("tasks.list.empty.title")}
                      </p>
                      <p className="text-xs">{t("tasks.list.empty.hint")}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </AppSectionCard>
    </>
  )
}
