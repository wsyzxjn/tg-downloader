import { Navigate, Route, Routes } from "react-router-dom"
import { PageHeader } from "@/components/app/page-header"
import { TopNav } from "@/components/app/top-nav"
import { AppProvider, useAppAuth, useAppFlow, useAppRoute, useAppUi } from "@/context/app-context"
import { InitPage } from "@/pages/init"
import { LoginPage } from "@/pages/login"
import { SettingsPage } from "@/pages/settings"
import { TasksPage } from "@/pages/tasks"
import { MessageDialog } from "./components/ui/message-dialog"

function AppRoutes() {
  const { authConfigured, authenticated } = useAppAuth()
  const { initFlow } = useAppFlow()
  const { isPublicRoute } = useAppRoute()
  const { clearNotice, notice } = useAppUi()

  return (
    <div className="min-h-screen scrollbar-gutter-stable bg-[radial-gradient(circle_at_8%_10%,#f4f4f4_0%,#efefef_42%,#e8e8e8_100%)] text-foreground dark:bg-[radial-gradient(circle_at_8%_10%,#242424_0%,#1e1e1e_45%,#161616_100%)]">
      <TopNav />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {!isPublicRoute ? <PageHeader /> : null}

        <MessageDialog open={Boolean(notice)} message={notice} onClose={clearNotice} />

        <Routes>
          <Route path="/init" element={<InitPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route
            path="*"
            element={
              <Navigate
                to={
                  initFlow.configured
                    ? authConfigured && !authenticated
                      ? "/login"
                      : "/tasks"
                    : "/init"
                }
                replace
              />
            }
          />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}
