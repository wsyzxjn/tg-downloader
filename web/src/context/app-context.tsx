import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"
import { useAppRuntime } from "@/hooks/use-app-runtime"
import { useInitFlow } from "@/hooks/use-init-flow"
import { useTaskActions } from "@/hooks/use-task-actions"
import { useThemeMode } from "@/hooks/use-theme-mode"
import { fetchWebAuthStatus, loginWeb } from "@/services/api"

interface RouteContextValue {
  isInitRoute: boolean
  isLoginRoute: boolean
  isTaskRoute: boolean
  isPublicRoute: boolean
  navigateTo: (path: "/tasks" | "/init" | "/login") => void
}

interface UiContextValue {
  loading: boolean
  setLoading: (loading: boolean) => void
  notice: string
  setNotice: (message: string) => void
  clearNotice: () => void
}

interface AuthContextValue {
  authConfigured: boolean | null
  authenticated: boolean | null
  loggingIn: boolean
  loginUsername: string
  loginPassword: string
  setLoginUsername: (value: string) => void
  setLoginPassword: (value: string) => void
  loadAuthStatus: () => Promise<{
    configured: boolean
    authConfigured: boolean
    authenticated: boolean
  }>
  handleWebLogin: () => Promise<void>
}

interface FlowContextValue {
  initFlow: ReturnType<typeof useInitFlow>
  taskActions: ReturnType<typeof useTaskActions>
}

interface ThemeContextValue {
  themeMode: ReturnType<typeof useThemeMode>["themeMode"]
  setThemeMode: ReturnType<typeof useThemeMode>["setThemeMode"]
}

const RouteContext = createContext<RouteContextValue | null>(null)
const UiContext = createContext<UiContextValue | null>(null)
const AuthContext = createContext<AuthContextValue | null>(null)
const FlowContext = createContext<FlowContextValue | null>(null)
const ThemeContext = createContext<ThemeContextValue | null>(null)

function useRequiredContext<T>(context: React.Context<T | null>, hookName: string): T {
  const value = useContext(context)
  if (!value) {
    throw new Error(`${hookName} must be used within AppProvider`)
  }
  return value
}

export function AppProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isInitRoute = location.pathname === "/init"
  const isLoginRoute = location.pathname === "/login"
  const isTaskRoute = location.pathname === "/tasks" || location.pathname === "/"
  const isPublicRoute = isInitRoute || isLoginRoute

  const navigateTo = useCallback(
    (path: "/tasks" | "/init" | "/login") => {
      navigate(path)
    },
    [navigate]
  )

  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState("")
  const clearNotice = useCallback(() => {
    setNotice("")
  }, [])

  const { themeMode, setThemeMode } = useThemeMode()

  const initFlow = useInitFlow({
    navigateTo,
    onNotice: setNotice,
  })

  const taskActions = useTaskActions({
    configured: initFlow.configured,
    onNotice: setNotice,
  })

  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginUsername, setLoginUsername] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  const loadAuthStatus = useCallback(async () => {
    const status = await fetchWebAuthStatus()
    initFlow.setConfigured(status.configured)
    setAuthConfigured(status.authConfigured)
    setAuthenticated(status.authenticated)
    return status
  }, [initFlow])

  const handleWebLogin = useCallback(async () => {
    const username = loginUsername.trim()
    const password = loginPassword.trim()
    if (!username || !password) {
      setNotice(t("messages.enter_web_credentials"))
      return
    }

    setLoggingIn(true)
    try {
      await loginWeb({
        username,
        password,
      })
      setLoginPassword("")
      const status = await loadAuthStatus()
      if (status.authenticated) {
        navigateTo("/tasks")
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("messages.web_login_failed"))
    } finally {
      setLoggingIn(false)
    }
  }, [loadAuthStatus, loginPassword, loginUsername, navigateTo, t])

  useAppRuntime({
    isInitRoute,
    isLoginRoute,
    configured: initFlow.configured,
    authConfigured,
    authenticated,
    loadAuthStatus,
    loadConfig: initFlow.loadConfig,
    loadTasks: taskActions.loadTasks,
    setLoading,
    onLoadError: setNotice,
    navigateTo,
    replaceTasks: taskActions.replaceTasks,
    upsertTask: taskActions.upsertTask,
    removeTask: taskActions.removeTask,
  })

  const routeValue = useMemo<RouteContextValue>(
    () => ({
      isInitRoute,
      isLoginRoute,
      isTaskRoute,
      isPublicRoute,
      navigateTo,
    }),
    [isInitRoute, isLoginRoute, isPublicRoute, isTaskRoute, navigateTo]
  )

  const uiValue = useMemo<UiContextValue>(
    () => ({
      loading,
      setLoading,
      notice,
      setNotice,
      clearNotice,
    }),
    [clearNotice, loading, notice]
  )

  const authValue = useMemo<AuthContextValue>(
    () => ({
      authConfigured,
      authenticated,
      loggingIn,
      loginUsername,
      loginPassword,
      setLoginUsername,
      setLoginPassword,
      loadAuthStatus,
      handleWebLogin,
    }),
    [
      authConfigured,
      authenticated,
      handleWebLogin,
      loadAuthStatus,
      loggingIn,
      loginPassword,
      loginUsername,
    ]
  )

  const flowValue = useMemo<FlowContextValue>(
    () => ({
      initFlow,
      taskActions,
    }),
    [initFlow, taskActions]
  )

  const themeValue = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      setThemeMode,
    }),
    [setThemeMode, themeMode]
  )

  return (
    <RouteContext.Provider value={routeValue}>
      <UiContext.Provider value={uiValue}>
        <AuthContext.Provider value={authValue}>
          <FlowContext.Provider value={flowValue}>
            <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
          </FlowContext.Provider>
        </AuthContext.Provider>
      </UiContext.Provider>
    </RouteContext.Provider>
  )
}

export function useAppRoute() {
  return useRequiredContext(RouteContext, "useAppRoute")
}

export function useAppUi() {
  return useRequiredContext(UiContext, "useAppUi")
}

export function useAppAuth() {
  return useRequiredContext(AuthContext, "useAppAuth")
}

export function useAppFlow() {
  return useRequiredContext(FlowContext, "useAppFlow")
}

export function useAppTheme() {
  return useRequiredContext(ThemeContext, "useAppTheme")
}
