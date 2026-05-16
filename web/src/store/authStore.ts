import { create } from "zustand"
import { fetchWebAuthStatus, loginWeb } from "@/services/api"
import type { WebAuthStatusResponse } from "@/types/app"
import { getErrorMessage, notify, t } from "./storeUtils"

interface AuthStore {
  configured: boolean | null
  authConfigured: boolean | null
  authenticated: boolean | null
  loggingIn: boolean
  loginUsername: string
  loginPassword: string
  setConfigured: (configured: boolean | null) => void
  setLoginUsername: (loginUsername: string) => void
  setLoginPassword: (loginPassword: string) => void
  loadAuthStatus: () => Promise<WebAuthStatusResponse>
  login: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  configured: null,
  authConfigured: null,
  authenticated: null,
  loggingIn: false,
  loginUsername: "",
  loginPassword: "",
  setConfigured: configured => {
    set({ configured })
  },
  setLoginUsername: loginUsername => {
    set({ loginUsername })
  },
  setLoginPassword: loginPassword => {
    set({ loginPassword })
  },
  loadAuthStatus: async () => {
    const status = await fetchWebAuthStatus()
    set({
      configured: status.configured,
      authConfigured: status.authConfigured,
      authenticated: status.authenticated,
    })
    return status
  },
  login: async () => {
    const { loginPassword, loginUsername } = get()
    const username = loginUsername.trim()
    const password = loginPassword.trim()

    if (!username || !password) {
      notify(t("messages.enter_web_credentials"))
      return
    }

    set({ loggingIn: true })
    try {
      await loginWeb({
        username,
        password,
      })
      set({ loginPassword: "" })
      await get().loadAuthStatus()
    } catch (error) {
      notify(getErrorMessage(error, "messages.web_login_failed"))
    } finally {
      set({ loggingIn: false })
    }
  },
}))
