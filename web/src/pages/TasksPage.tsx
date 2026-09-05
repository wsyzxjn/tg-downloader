import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  Copy,
  Download,
  FileText,
  Inbox,
  Link2,
  Loader2,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
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
import { cn } from "@/lib/utils"
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

function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) {
    return ""
  }
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`
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
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)
  const [copiedResultId, setCopiedResultId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all")

  const handleCopy = (text: string, type: "task" | "result", id: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      if (type === "task") {
        setCopiedTaskId(id)
        setTimeout(() => setCopiedTaskId(null), 1800)
      } else {
        setCopiedResultId(id)
        setTimeout(() => setCopiedResultId(null), 1800)
      }
    })
  }

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") return tasks
    if (statusFilter === "failed") {
      return tasks.filter(task => task.status === "failed" || task.status === "canceled")
    }
    return tasks.filter(task => task.status === statusFilter)
  }, [tasks, statusFilter])

  const taskCounts = useMemo(() => {
    const running = tasks.filter(t => t.status === "running").length
    const pending = tasks.filter(t => t.status === "pending").length
    const completed = tasks.filter(t => t.status === "completed").length
    const failed = tasks.filter(t => t.status === "failed" || t.status === "canceled").length
    return { all: tasks.length, running, pending, completed, failed }
  }, [tasks])

  return (
    <>
      <AppSectionCard
        title={t("tasks.create.title")}
        contentClassName="pt-5"
        headerClassName="pb-1"
      >
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault()
            void createTask()
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="relative flex-1 space-y-1.5">
              <Label
                htmlFor="link"
                className="text-xs sm:text-sm font-medium text-muted-foreground"
              >
                {t("tasks.create.link_label")}
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                </div>
                <Input
                  id="link"
                  placeholder={t("tasks.create.link_placeholder")}
                  value={linkInput}
                  onChange={event => setLinkInput(event.target.value)}
                  className="pl-9 pr-8 font-mono text-xs sm:text-sm h-10"
                />
                {linkInput ? (
                  <button
                    type="button"
                    onClick={() => setLinkInput("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground"
                    title={t("tasks.create.clear", "清空输入")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <Button
              type="submit"
              disabled={creatingTask || bootstrapping || !linkInput.trim()}
              className="h-10 min-w-[140px] shrink-0 font-medium"
            >
              {creatingTask ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t("tasks.create.creating")}</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>{t("tasks.create.button")}</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <p>{t("tasks.create.hint")}</p>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/70">
              <span>{t("tasks.create.examples_title", "示例：")}</span>
              <button
                type="button"
                onClick={() => setLinkInput("https://t.me/telegram/193")}
                className="rounded-xs bg-muted/60 px-1.5 py-0.5 hover:bg-muted hover:text-foreground transition-colors"
              >
                t.me/telegram/193
              </button>
            </div>
          </div>
        </form>
      </AppSectionCard>

      <AppSectionCard
        title={t("tasks.list.title")}
        contentClassName="px-0 pb-0 pt-3"
        headerClassName="pb-2 border-b border-border/40"
        action={
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === "all"
                  ? "bg-secondary text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{t("tasks.filter.all", "全部")}</span>
              <span className="text-[10px] opacity-70">({taskCounts.all})</span>
            </button>
            {taskCounts.running > 0 ? (
              <button
                type="button"
                onClick={() => setStatusFilter("running")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  statusFilter === "running"
                    ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold"
                    : "text-sky-600/80 hover:text-sky-600"
                )}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
                </span>
                <span>{t("tasks.filter.running", "进行中")}</span>
                <span className="text-[10px]">({taskCounts.running})</span>
              </button>
            ) : null}
            {taskCounts.pending > 0 ? (
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  statusFilter === "pending"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{t("tasks.filter.pending", "排队中")}</span>
                <span className="text-[10px]">({taskCounts.pending})</span>
              </button>
            ) : null}
            {taskCounts.completed > 0 ? (
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  statusFilter === "completed"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{t("tasks.filter.completed", "已完成")}</span>
                <span className="text-[10px]">({taskCounts.completed})</span>
              </button>
            ) : null}
            {taskCounts.failed > 0 ? (
              <button
                type="button"
                onClick={() => setStatusFilter("failed")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  statusFilter === "failed"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{t("tasks.filter.failed", "失败/取消")}</span>
                <span className="text-[10px]">({taskCounts.failed})</span>
              </button>
            ) : null}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/50 text-xs">
                <TableHead className="w-[120px]">{t("tasks.list.headers.id")}</TableHead>
                <TableHead className="w-[90px]">{t("tasks.list.headers.type")}</TableHead>
                <TableHead className="w-[110px]">{t("tasks.list.headers.status")}</TableHead>
                <TableHead className="w-[260px]">
                  {t("tasks.list.headers.progress")} / {t("tasks.list.headers.speed")}
                </TableHead>
                <TableHead className="w-[160px]">{t("tasks.list.headers.updated_at")}</TableHead>
                <TableHead className="min-w-[200px]">{t("tasks.list.headers.result")}</TableHead>
                <TableHead className="w-[100px] text-right">
                  {t("tasks.list.headers.action")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map(task => {
                const progressPercent = normalizeProgressPercent(task.status, task.progress.percent)
                const resultText = getTaskResultText(task)
                const isRunning = task.status === "running"
                const isCompleted = task.status === "completed"
                const isFailed = task.status === "failed"
                const isPending = task.status === "pending"

                return (
                  <TableRow
                    key={task.id}
                    className={cn(
                      "group transition-colors hover:bg-muted/30 border-b border-border/30",
                      task.status === "canceled" && "opacity-60"
                    )}
                  >
                    {/* Task ID with Copy */}
                    <TableCell className="font-mono text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                          {task.id.slice(0, 8)}...
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(task.id, "task", task.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-xs hover:bg-muted text-muted-foreground hover:text-foreground"
                          title={t("tasks.actions.copy_id", "复制任务 ID")}
                        >
                          {copiedTaskId === task.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </TableCell>

                    {/* Task Type */}
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px] font-normal py-0">
                        {t(`tasks.type.${task.type}` as const, taskTypeLabel(task.type))}
                      </Badge>
                    </TableCell>

                    {/* Task Status */}
                    <TableCell>
                      <Badge
                        variant={statusTone(task.status)}
                        className="flex w-fit items-center gap-1 py-0.5 text-[11px] font-medium"
                      >
                        {isRunning ? (
                          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                        ) : isFailed ? (
                          <AlertCircle className="h-3 w-3 shrink-0" />
                        ) : isPending ? (
                          <Clock className="h-3 w-3 shrink-0" />
                        ) : null}
                        <span>{t(`tasks.status.${task.status}` as const)}</span>
                      </Badge>
                    </TableCell>

                    {/* Progress Column */}
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                          <span className="font-mono font-semibold text-foreground/90">
                            {progressPercent}%
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            {task.progress.downloaded && task.progress.total ? (
                              <span>
                                {formatBytes(task.progress.downloaded)} /{" "}
                                {formatBytes(task.progress.total)}
                              </span>
                            ) : null}
                            <span className="text-foreground/75">
                              {formatSpeed(task.progress.speedBytesPerSec)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300 ease-out",
                              isCompleted
                                ? "bg-emerald-500"
                                : isFailed
                                  ? "bg-destructive"
                                  : isRunning
                                    ? "bg-primary shadow-xs"
                                    : "bg-muted-foreground/40"
                            )}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Updated At */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(task.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>

                    {/* Result */}
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-1.5">
                        {isCompleted ? (
                          task.result?.destination === "openlist" ? (
                            <span title="OpenList 网盘" className="inline-flex shrink-0">
                              <Cloud className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                            </span>
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )
                        ) : isFailed ? (
                          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : null}
                        <span
                          className={cn(
                            "truncate text-xs",
                            isFailed ? "text-destructive font-medium" : "text-muted-foreground"
                          )}
                          title={resultText}
                        >
                          {resultText}
                        </span>
                        {resultText && resultText !== "-" && !isFailed ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(resultText, "result", task.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-xs hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                            title={t("tasks.actions.copy_result", "复制路径")}
                          >
                            {copiedResultId === task.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      {task.status === "pending" || task.status === "running" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cancelingTaskId === task.id}
                          onClick={() => void cancelTask(task.id)}
                          className="h-7 px-2 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                        >
                          {cancelingTaskId === task.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3 mr-1" />
                          )}
                          <span>
                            {cancelingTaskId === task.id
                              ? t("tasks.actions.canceling")
                              : t("tasks.actions.cancel")}
                          </span>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}

              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-[220px] text-center">
                    <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <Inbox className="h-8 w-8 text-muted-foreground/40 mb-1" />
                      <p className="text-sm font-medium text-foreground">
                        {t("tasks.list.empty.title")}
                      </p>
                      <p className="text-xs text-muted-foreground/75">
                        {t("tasks.list.empty.hint")}
                      </p>
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
