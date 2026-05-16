import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { AppLifecycle } from "@/components/app/AppLifecycle"
import { PageHeader } from "@/components/app/PageHeader"
import { TopNav } from "@/components/app/TopNav"
import { MessageDialog } from "@/components/ui/MessageDialog"
import { InitPage } from "@/pages/InitPage"
import { LoginPage } from "@/pages/LoginPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { TasksPage } from "@/pages/TasksPage"
import { useAuthStore } from "@/store/authStore"
import { useUiStore } from "@/store/uiStore"
import { getFallbackRoute, isPublicRoute } from "@/utils/routes"

function AppRoutes() {
  const pathname = useLocation().pathname
  const authConfigured = useAuthStore(state => state.authConfigured)
  const authenticated = useAuthStore(state => state.authenticated)
  const configured = useAuthStore(state => state.configured)
  const notice = useUiStore(state => state.notice)
  const clearNotice = useUiStore(state => state.clearNotice)

  return (
    <div className="min-h-screen scrollbar-gutter-stable bg-background text-foreground">
      <AppLifecycle />
      <TopNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
        {!isPublicRoute(pathname) ? <PageHeader /> : null}

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
              <Navigate to={getFallbackRoute(configured, authConfigured, authenticated)} replace />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export function App() {
  return <AppRoutes />
}
