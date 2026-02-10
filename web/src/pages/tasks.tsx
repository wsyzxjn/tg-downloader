import { Inbox, Link2, ListTodo, Plus, Send, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TaskRecord, TaskStatus } from "@/types/app"
import { statusTone, taskTypeLabel } from "@/utils/app"

interface TasksPageProps {
  loading: boolean
  creatingTask: boolean
  cancelingTaskId: string | null
  linkInput: string
  setLinkInput: (value: string) => void
  onCreateTask: () => void
  onCancelTask: (taskId: string) => void
  tasks: TaskRecord[]
}

function normalizeProgressPercent(status: TaskStatus, percent: number): number {
  if (status === "completed") {
    return 100
  }
  return Math.max(0, Math.min(100, percent))
}

export function TasksPage({
  loading,
  creatingTask,
  cancelingTaskId,
  linkInput,
  setLinkInput,
  onCreateTask,
  onCancelTask,
  tasks,
}: TasksPageProps) {
  const { t } = useTranslation()

  const formatSpeed = (speedBytesPerSec: number | undefined) => {
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

  return (
    <>
      <Card className="overflow-hidden border-border/60 bg-card/60 shadow-md backdrop-blur-md transition-all">
        <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("tasks.create.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="link" className="text-sm font-medium text-muted-foreground">
                {t("tasks.create.link_label")}
              </Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="link"
                  placeholder={t("tasks.create.link_placeholder")}
                  value={linkInput}
                  onChange={event => setLinkInput(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Button
              disabled={creatingTask || loading}
              onClick={onCreateTask}
              className="min-w-[140px] shadow-sm"
            >
              {creatingTask ? (
                <>
                  <Send className="mr-2 h-4 w-4 animate-pulse" />
                  {t("tasks.create.creating")}
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("tasks.create.button")}
                </>
              )}
            </Button>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
            {t("tasks.create.hint")}
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/60 bg-card/60 shadow-md backdrop-blur-md transition-all">
        <CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <ListTodo className="h-5 w-5 text-primary" />
            {t("tasks.list.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table className="min-w-[1000px]">
              <TableHeader className="bg-muted/20">
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
                  const progressPercent = normalizeProgressPercent(
                    task.status,
                    task.progress.percent
                  )

                  // Keep single color for progress bar
                  const progressColorClass = "bg-primary"

                  // Determine row style
                  const isCanceled = task.status === "canceled"
                  const rowClass = isCanceled
                    ? "group transition-colors hover:bg-muted/30 opacity-60 grayscale-[0.5]"
                    : "group transition-colors hover:bg-muted/30"

                  return (
                    <TableRow key={task.id} className={rowClass}>
                      <TableCell className="max-w-[160px] truncate font-mono text-xs font-medium text-muted-foreground group-hover:text-foreground">
                        {task.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal whitespace-nowrap">
                          {t(`tasks.type.${task.type}` as const, taskTypeLabel(task.type))}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusTone(task.status)}
                          className="shadow-sm whitespace-nowrap"
                        >
                          {t(`tasks.status.${task.status}` as const)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                            <span>{progressPercent}%</span>
                            <span>{formatSpeed(task.progress.speedBytesPerSec)}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-secondary/50 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ease-out ${progressColorClass}`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(task.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[250px] text-xs text-muted-foreground">
                        {task.result?.error ? (
                          <div
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors w-full"
                            title={task.result.error}
                          >
                            <span className="truncate">{task.result.error}</span>
                          </div>
                        ) : (
                          <div className="truncate w-full" title={task.result?.filePath}>
                            {task.result?.filePath || (
                              <span className="text-muted-foreground/50">-</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        {task.status === "pending" || task.status === "running" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cancelingTaskId === task.id}
                            onClick={() => onCancelTask(task.id)}
                            className="h-7 text-xs whitespace-nowrap"
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
                      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                          <Inbox className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {t("tasks.list.empty.title")}
                          </p>
                          <p className="text-xs text-muted-foreground/80">
                            {t("tasks.list.empty.hint")}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
