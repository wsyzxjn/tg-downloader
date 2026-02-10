import { useCallback, useState } from "react"
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { TopNav } from "@/components/app/top-nav"
import { MessageDialog } from "@/components/ui/message-dialog"
import { useInitialLoad, useRouteGuard, useTaskPolling } from "@/hooks/use-app-effects"
import { useInitFlow } from "@/hooks/use-init-flow"
import { useTaskActions } from "@/hooks/use-task-actions"
import { useThemeMode } from "@/hooks/use-theme-mode"
import { InitPage } from "@/pages/init"
import { SettingsPage } from "@/pages/settings"
import { TasksPage } from "@/pages/tasks"

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const isInitRoute = location.pathname === "/init"
  const isTaskRoute = location.pathname === "/tasks" || location.pathname === "/"
  const navigateTo = useCallback(
    (path: "/" | "/init") => {
      navigate(path)
    },
    [navigate]
  )

  const { themeMode, setThemeMode } = useThemeMode()

  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState("")

  const initFlow = useInitFlow({
    navigateTo,
    onNotice: setNotice,
  })

  const taskActions = useTaskActions({
    configured: initFlow.configured,
    onNotice: setNotice,
  })

  useInitialLoad({
    isInitRoute,
    loadConfig: initFlow.loadConfig,
    loadTasks: taskActions.loadTasks,
    setLoading,
    onLoadError: setNotice,
  })

  useRouteGuard({
    configured: initFlow.configured,
    isInitRoute,
    navigateTo,
  })

  useTaskPolling({
    isInitRoute,
    configured: initFlow.configured,
    loadTasks: taskActions.loadTasks,
    replaceTasks: taskActions.replaceTasks,
    upsertTask: taskActions.upsertTask,
    removeTask: taskActions.removeTask,
  })

  return (
    <div className="min-h-screen scrollbar-gutter-stable bg-[radial-gradient(circle_at_8%_10%,#f4f4f4_0%,#efefef_42%,#e8e8e8_100%)] text-foreground dark:bg-[radial-gradient(circle_at_8%_10%,#242424_0%,#1e1e1e_45%,#161616_100%)]">
      <TopNav isInitRoute={isInitRoute} themeMode={themeMode} setThemeMode={setThemeMode} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <PageHeader
          configured={initFlow.configured}
          isInitRoute={isInitRoute}
          isTaskRoute={isTaskRoute}
          activeTaskCount={taskActions.activeTaskCount}
          onRefreshTasks={() => void taskActions.loadTasks()}
        />

        <MessageDialog open={Boolean(notice)} message={notice} onClose={() => setNotice("")} />

        <Routes>
          <Route
            path="/init"
            element={
              <InitPage
                initStep={initFlow.initStep}
                loading={loading}
                savingConfig={initFlow.savingConfig}
                form={initFlow.form}
                setForm={initFlow.setForm}
                allowedUserIdsInput={initFlow.allowedUserIdsInput}
                setAllowedUserIdsInput={initFlow.setAllowedUserIdsInput}
                mediaTypes={initFlow.mediaTypes}
                toggleMediaType={initFlow.toggleMediaType}
                testingProxy={initFlow.testingProxy}
                initStepOneIssues={initFlow.initStepOneIssues}
                canProceedInitStepOne={initFlow.canProceedInitStepOne}
                authPhoneNumber={initFlow.authPhoneNumber}
                setAuthPhoneNumber={initFlow.setAuthPhoneNumber}
                authCodeSent={initFlow.authCodeSent}
                authCode={initFlow.authCode}
                setAuthCode={initFlow.setAuthCode}
                authPassword={initFlow.authPassword}
                setAuthPassword={initFlow.setAuthPassword}
                authSession={initFlow.authSession}
                authIdentity={initFlow.authIdentity}
                sendingCode={initFlow.sendingCode}
                verifyingCode={initFlow.verifyingCode}
                onInitStepNext={initFlow.handleInitStepNext}
                onBackToStepOne={() => initFlow.setInitStep(1)}
                onSendLoginCode={() => void initFlow.handleSendLoginCode()}
                onVerifyLogin={() => void initFlow.handleVerifyLogin()}
                onInitConfig={() => void initFlow.handleInitConfig()}
                onTestProxy={() => void initFlow.handleTestProxy()}
              />
            }
          />
          <Route
            path="/tasks"
            element={
              <TasksPage
                loading={loading}
                creatingTask={taskActions.creatingTask}
                cancelingTaskId={taskActions.cancelingTaskId}
                linkInput={taskActions.linkInput}
                setLinkInput={taskActions.setLinkInput}
                onCreateTask={() => void taskActions.handleCreateTask()}
                onCancelTask={taskId => void taskActions.handleCancelTask(taskId)}
                tasks={taskActions.tasks}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                loading={loading}
                savingConfig={initFlow.savingConfig}
                form={initFlow.form}
                setForm={initFlow.setForm}
                allowedUserIdsInput={initFlow.allowedUserIdsInput}
                setAllowedUserIdsInput={initFlow.setAllowedUserIdsInput}
                mediaTypes={initFlow.mediaTypes}
                toggleMediaType={initFlow.toggleMediaType}
                testingProxy={initFlow.testingProxy}
                onSaveConfig={() => void initFlow.handleSaveConfig()}
                onTestProxy={() => void initFlow.handleTestProxy()}
              />
            }
          />
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route
            path="*"
            element={<Navigate to={initFlow.configured ? "/tasks" : "/init"} replace />}
          />
        </Routes>
      </div>
    </div>
  )
}
