import { create } from "zustand"
import { DEFAULT_MEDIA_TYPES, DEFAULT_SETTING_FORM } from "@/constants/app"
import {
  fetchConfig,
  initConfig,
  saveConfig,
  sendTelegramCode,
  testTelegramProxy,
  verifyTelegramLogin,
} from "@/services/api"
import type { Setting, SettingForm } from "@/types/app"
import {
  buildProxyUrl,
  normalizeInitSettingPayload,
  normalizeSettingPayload,
  toForm,
  validateStepOne,
} from "@/utils/app"
import { useAuthStore } from "./authStore"
import { getErrorMessage, notify, t } from "./storeUtils"

interface ConfigStore {
  initStep: 1 | 2
  form: SettingForm
  allowedUserIdsInput: string
  mediaTypes: string[]
  savingConfig: boolean
  sendingCode: boolean
  verifyingCode: boolean
  testingProxy: boolean
  authPhoneNumber: string
  authCodeSent: boolean
  authCode: string
  authPassword: string
  authSession: string
  authIdentity: string
  setInitStep: (initStep: 1 | 2) => void
  setFormField: <K extends keyof SettingForm>(field: K, value: SettingForm[K]) => void
  setAllowedUserIdsInput: (allowedUserIdsInput: string) => void
  toggleMediaType: (mediaType: string) => void
  setAuthPhoneNumber: (authPhoneNumber: string) => void
  setAuthCode: (authCode: string) => void
  setAuthPassword: (authPassword: string) => void
  resetConfigDraft: () => void
  applySetting: (setting: Setting) => void
  loadConfig: () => Promise<void>
  saveSettings: () => Promise<void>
  initializeSettings: () => Promise<void>
  goToInitStepTwo: () => void
  sendLoginCode: () => Promise<void>
  verifyTelegramAuth: () => Promise<void>
  testProxyConnection: () => Promise<void>
}

function getStepOneIssues(state: Pick<ConfigStore, "form" | "allowedUserIdsInput" | "mediaTypes">) {
  return validateStepOne(state.form, state.allowedUserIdsInput, state.mediaTypes, t)
}

function getTelegramApiDraft(form: SettingForm) {
  const apiId = Number(form.apiId)
  const apiHash = form.apiHash.trim()

  if (Number.isNaN(apiId)) {
    notify(t("messages.enter_api_id"))
    return null
  }

  if (!apiHash) {
    notify(t("messages.enter_api_hash"))
    return null
  }

  return {
    apiId,
    apiHash,
    proxy: buildProxyUrl(form),
  }
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  initStep: 1,
  form: { ...DEFAULT_SETTING_FORM },
  allowedUserIdsInput: "",
  mediaTypes: [...DEFAULT_MEDIA_TYPES],
  savingConfig: false,
  sendingCode: false,
  verifyingCode: false,
  testingProxy: false,
  authPhoneNumber: "",
  authCodeSent: false,
  authCode: "",
  authPassword: "",
  authSession: "",
  authIdentity: "",
  setInitStep: initStep => {
    set({ initStep })
  },
  setFormField: (field, value) => {
    set(state => ({
      form: {
        ...state.form,
        [field]: value,
      },
    }))
  },
  setAllowedUserIdsInput: allowedUserIdsInput => {
    set({ allowedUserIdsInput })
  },
  toggleMediaType: mediaType => {
    set(state => ({
      mediaTypes: state.mediaTypes.includes(mediaType)
        ? state.mediaTypes.filter(item => item !== mediaType)
        : [...state.mediaTypes, mediaType],
    }))
  },
  setAuthPhoneNumber: authPhoneNumber => {
    set({
      authPhoneNumber,
      authCodeSent: false,
      authCode: "",
      authPassword: "",
      authSession: "",
      authIdentity: "",
    })
  },
  setAuthCode: authCode => {
    set({ authCode })
  },
  setAuthPassword: authPassword => {
    set({ authPassword })
  },
  resetConfigDraft: () => {
    set({
      initStep: 1,
      form: { ...DEFAULT_SETTING_FORM },
      allowedUserIdsInput: "",
      mediaTypes: [...DEFAULT_MEDIA_TYPES],
      authPhoneNumber: "",
      authCodeSent: false,
      authCode: "",
      authPassword: "",
      authSession: "",
      authIdentity: "",
    })
  },
  applySetting: setting => {
    useAuthStore.getState().setConfigured(true)
    set({
      initStep: 1,
      form: toForm(setting),
      allowedUserIdsInput: setting.allowedUserIds.join(", "),
      mediaTypes: [...setting.mediaTypes],
      authPhoneNumber: "",
      authCodeSent: false,
      authCode: "",
      authPassword: "",
      authSession: setting.session || "",
      authIdentity: "",
    })
  },
  loadConfig: async () => {
    const result = await fetchConfig()
    useAuthStore.getState().setConfigured(result.configured)

    if (result.data) {
      get().applySetting(result.data)
      return
    }

    get().resetConfigDraft()
  },
  saveSettings: async () => {
    if (!useAuthStore.getState().configured) {
      notify(t("messages.not_initialized"))
      return
    }

    set({ savingConfig: true })
    try {
      const { allowedUserIdsInput, authSession, form, mediaTypes } = get()
      const payload = normalizeSettingPayload(form, allowedUserIdsInput, mediaTypes, t, authSession)
      const setting = await saveConfig(payload)
      get().applySetting(setting)
      notify(t("messages.config_saved"))
    } catch (error) {
      notify(getErrorMessage(error, "messages.config_save_failed"))
    } finally {
      set({ savingConfig: false })
    }
  },
  initializeSettings: async () => {
    if (!get().authSession) {
      notify(t("messages.auth_required"))
      return
    }

    set({ savingConfig: true })
    try {
      const { allowedUserIdsInput, authSession, form, mediaTypes } = get()
      const setting = await initConfig(
        normalizeInitSettingPayload(form, allowedUserIdsInput, mediaTypes, t, authSession)
      )
      get().applySetting(setting)
      notify(t("messages.init_complete"))
      await useAuthStore.getState().loadAuthStatus()
    } catch (error) {
      notify(getErrorMessage(error, "messages.init_failed"))
    } finally {
      set({ savingConfig: false })
    }
  },
  goToInitStepTwo: () => {
    const issues = getStepOneIssues(get())
    if (issues.length > 0) {
      notify(issues[0])
      return
    }

    set({
      initStep: 2,
      authPhoneNumber: "",
      authCodeSent: false,
      authCode: "",
      authPassword: "",
      authSession: "",
      authIdentity: "",
    })
  },
  sendLoginCode: async () => {
    const { authPhoneNumber, form } = get()
    const telegramApi = getTelegramApiDraft(form)

    if (!telegramApi) {
      return
    }

    if (!authPhoneNumber.trim()) {
      notify(t("messages.enter_phone"))
      return
    }

    set({ sendingCode: true })
    try {
      await sendTelegramCode({
        ...telegramApi,
        phoneNumber: authPhoneNumber.trim(),
      })
      set({ authCodeSent: true })
      notify(t("messages.code_sent"))
    } catch (error) {
      notify(getErrorMessage(error, "messages.send_code_failed"))
    } finally {
      set({ sendingCode: false })
    }
  },
  verifyTelegramAuth: async () => {
    const { authCode, authPassword, authPhoneNumber, form } = get()
    const telegramApi = getTelegramApiDraft(form)

    if (!telegramApi) {
      return
    }

    if (!authPhoneNumber.trim() || !authCode.trim()) {
      notify(t("messages.enter_phone_code"))
      return
    }

    set({ verifyingCode: true })
    try {
      const result = await verifyTelegramLogin({
        ...telegramApi,
        phoneNumber: authPhoneNumber.trim(),
        phoneCode: authCode.trim(),
        password: authPassword.trim() || undefined,
      })

      if (result.needPassword) {
        notify(t("messages.2fa_required"))
        return
      }

      if (!result.session) {
        throw new Error(t("messages.login_no_session"))
      }

      const identity = result.username
        ? `@${result.username}`
        : result.firstName || String(result.userId || "")

      set({
        authSession: result.session,
        authIdentity: identity,
      })
      notify(t("messages.auth_success"))
    } catch (error) {
      const message = getErrorMessage(error, "messages.auth_failed")
      if (message.includes("重新发送验证码") || message.includes("验证码已过期")) {
        set({
          authCodeSent: false,
          authCode: "",
          authPassword: "",
        })
      }
      notify(message)
    } finally {
      set({ verifyingCode: false })
    }
  },
  testProxyConnection: async () => {
    const { form } = get()
    const telegramApi = getTelegramApiDraft(form)

    if (!telegramApi) {
      return
    }

    if (!telegramApi.proxy) {
      notify(t("messages.proxy_missing"))
      return
    }

    set({ testingProxy: true })
    try {
      await testTelegramProxy(telegramApi)
      notify(t("messages.proxy_test_success"))
    } catch (error) {
      notify(getErrorMessage(error, "messages.proxy_test_failed"))
    } finally {
      set({ testingProxy: false })
    }
  },
}))
