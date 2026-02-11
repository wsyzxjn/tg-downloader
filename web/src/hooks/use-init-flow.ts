import type { Dispatch, SetStateAction } from "react"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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

interface UseInitFlowParams {
  navigateTo: (path: "/tasks" | "/init" | "/login") => void
  onNotice: (message: string) => void
}

interface UseInitFlowResult {
  configured: boolean | null
  setConfigured: Dispatch<SetStateAction<boolean | null>>
  initStep: 1 | 2
  savingConfig: boolean
  sendingCode: boolean
  verifyingCode: boolean
  testingProxy: boolean
  form: SettingForm
  setForm: Dispatch<SetStateAction<SettingForm>>
  allowedUserIdsInput: string
  setAllowedUserIdsInput: Dispatch<SetStateAction<string>>
  mediaTypes: string[]
  toggleMediaType: (mediaType: string) => void
  authPhoneNumber: string
  setAuthPhoneNumber: (value: string) => void
  authCodeSent: boolean
  authCode: string
  setAuthCode: Dispatch<SetStateAction<string>>
  authPassword: string
  setAuthPassword: Dispatch<SetStateAction<string>>
  authSession: string
  authIdentity: string
  initStepOneIssues: string[]
  canProceedInitStepOne: boolean
  setInitStep: Dispatch<SetStateAction<1 | 2>>
  loadConfig: () => Promise<void>
  handleSaveConfig: () => Promise<void>
  handleInitConfig: () => Promise<void>
  handleInitStepNext: () => void
  handleSendLoginCode: () => Promise<void>
  handleVerifyLogin: () => Promise<void>
  handleTestProxy: () => Promise<void>
}

export function useInitFlow({ navigateTo, onNotice }: UseInitFlowParams): UseInitFlowResult {
  const { t } = useTranslation()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [initStep, setInitStep] = useState<1 | 2>(1)

  const [form, setForm] = useState<SettingForm>(DEFAULT_SETTING_FORM)
  const [allowedUserIdsInput, setAllowedUserIdsInput] = useState("")
  const [mediaTypes, setMediaTypes] = useState<string[]>(DEFAULT_MEDIA_TYPES)

  const [savingConfig, setSavingConfig] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [testingProxy, setTestingProxy] = useState(false)

  const [authPhoneNumber, setAuthPhoneNumberState] = useState("")
  const [authCodeSent, setAuthCodeSent] = useState(false)
  const [authCode, setAuthCode] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authSession, setAuthSession] = useState("")
  const [authIdentity, setAuthIdentity] = useState("")

  const initStepOneIssues = useMemo(
    () => validateStepOne(form, allowedUserIdsInput, mediaTypes, t),
    [form, allowedUserIdsInput, mediaTypes, t]
  )
  const canProceedInitStepOne = initStepOneIssues.length === 0

  const toggleMediaType = useCallback((mediaType: string) => {
    setMediaTypes(prev =>
      prev.includes(mediaType) ? prev.filter(item => item !== mediaType) : [...prev, mediaType]
    )
  }, [])

  const resetInitState = useCallback(() => {
    setInitStep(1)
    setForm(DEFAULT_SETTING_FORM)
    setAllowedUserIdsInput("")
    setMediaTypes(DEFAULT_MEDIA_TYPES)
    setAuthSession("")
    setAuthIdentity("")
  }, [])

  const syncForm = useCallback((setting: Setting) => {
    setForm(toForm(setting))
    setAllowedUserIdsInput(setting.allowedUserIds.join(", "))
    setMediaTypes(setting.mediaTypes)
    setAuthSession(setting.session || "")
  }, [])

  const loadConfig = useCallback(async () => {
    const result = await fetchConfig()
    setConfigured(result.configured)

    if (result.data) {
      syncForm(result.data)
      return
    }

    resetInitState()
  }, [resetInitState, syncForm])

  const handleSaveConfig = useCallback(async () => {
    if (!configured) {
      onNotice(t("messages.not_initialized"))
      return
    }

    setSavingConfig(true)
    try {
      const payload = normalizeSettingPayload(form, allowedUserIdsInput, mediaTypes, t, authSession)
      const setting = await saveConfig(payload)
      setConfigured(true)
      syncForm(setting)
      onNotice(t("messages.config_saved"))
    } catch (error) {
      onNotice(error instanceof Error ? error.message : t("messages.config_save_failed"))
    } finally {
      setSavingConfig(false)
    }
  }, [allowedUserIdsInput, authSession, configured, form, mediaTypes, onNotice, syncForm, t])

  const handleInitConfig = useCallback(async () => {
    if (!authSession) {
      onNotice(t("messages.auth_required"))
      return
    }

    setSavingConfig(true)
    try {
      const setting = await initConfig(
        normalizeInitSettingPayload(form, allowedUserIdsInput, mediaTypes, t, authSession)
      )
      setConfigured(true)
      syncForm(setting)
      onNotice(t("messages.init_complete"))
      navigateTo("/tasks")
    } catch (error) {
      onNotice(error instanceof Error ? error.message : t("messages.init_failed"))
    } finally {
      setSavingConfig(false)
    }
  }, [allowedUserIdsInput, authSession, form, mediaTypes, navigateTo, onNotice, syncForm, t])

  const handleInitStepNext = useCallback(() => {
    if (!canProceedInitStepOne) {
      onNotice(initStepOneIssues[0])
      return
    }

    setAuthSession("")
    setAuthIdentity("")
    setAuthCodeSent(false)
    setAuthCode("")
    setAuthPassword("")
    setInitStep(2)
  }, [canProceedInitStepOne, initStepOneIssues, onNotice])

  const setAuthPhoneNumber = useCallback((value: string) => {
    setAuthPhoneNumberState(value)
    setAuthCodeSent(false)
    setAuthCode("")
    setAuthPassword("")
  }, [])

  const handleSendLoginCode = useCallback(async () => {
    const apiId = Number(form.apiId)
    if (Number.isNaN(apiId)) {
      onNotice(t("messages.enter_api_id"))
      return
    }

    if (!form.apiHash.trim()) {
      onNotice(t("messages.enter_api_hash"))
      return
    }

    if (!authPhoneNumber.trim()) {
      onNotice(t("messages.enter_phone"))
      return
    }

    setSendingCode(true)
    try {
      const proxy = buildProxyUrl(form)
      await sendTelegramCode({
        apiId,
        apiHash: form.apiHash.trim(),
        proxy,
        phoneNumber: authPhoneNumber.trim(),
      })
      setAuthCodeSent(true)
      onNotice(t("messages.code_sent"))
    } catch (error) {
      onNotice(error instanceof Error ? error.message : t("messages.send_code_failed"))
    } finally {
      setSendingCode(false)
    }
  }, [authPhoneNumber, form, onNotice, t])

  const handleVerifyLogin = useCallback(async () => {
    const apiId = Number(form.apiId)
    if (Number.isNaN(apiId)) {
      onNotice(t("messages.enter_api_id"))
      return
    }

    if (!form.apiHash.trim()) {
      onNotice(t("messages.enter_api_hash"))
      return
    }

    if (!authPhoneNumber.trim() || !authCode.trim()) {
      onNotice(t("messages.enter_phone_code"))
      return
    }

    setVerifyingCode(true)
    try {
      const proxy = buildProxyUrl(form)
      const result = await verifyTelegramLogin({
        apiId,
        apiHash: form.apiHash.trim(),
        proxy,
        phoneNumber: authPhoneNumber.trim(),
        phoneCode: authCode.trim(),
        password: authPassword.trim() || undefined,
      })

      if (result.needPassword) {
        onNotice(t("messages.2fa_required"))
        return
      }

      if (!result.session) {
        throw new Error(t("messages.login_no_session"))
      }

      setAuthSession(result.session)
      const identity = result.username
        ? `@${result.username}`
        : result.firstName || String(result.userId || "")
      setAuthIdentity(identity)
      onNotice(t("messages.auth_success"))
    } catch (error) {
      const message = error instanceof Error ? error.message : t("messages.auth_failed")
      if (message.includes("重新发送验证码") || message.includes("验证码已过期")) {
        setAuthCodeSent(false)
        setAuthCode("")
        setAuthPassword("")
      }
      onNotice(message)
    } finally {
      setVerifyingCode(false)
    }
  }, [authCode, authPassword, authPhoneNumber, form, onNotice, t])

  const handleTestProxy = useCallback(async () => {
    const apiId = Number(form.apiId)
    if (Number.isNaN(apiId)) {
      onNotice(t("messages.enter_api_id"))
      return
    }

    if (!form.apiHash.trim()) {
      onNotice(t("messages.enter_api_hash"))
      return
    }

    const proxy = buildProxyUrl(form)
    if (!proxy) {
      onNotice(t("messages.proxy_missing"))
      return
    }

    setTestingProxy(true)
    try {
      await testTelegramProxy({
        apiId,
        apiHash: form.apiHash.trim(),
        proxy,
      })
      onNotice(t("messages.proxy_test_success"))
    } catch (error) {
      onNotice(error instanceof Error ? error.message : t("messages.proxy_test_failed"))
    } finally {
      setTestingProxy(false)
    }
  }, [form, onNotice, t])

  return {
    configured,
    setConfigured,
    initStep,
    savingConfig,
    sendingCode,
    verifyingCode,
    testingProxy,
    form,
    setForm,
    allowedUserIdsInput,
    setAllowedUserIdsInput,
    mediaTypes,
    toggleMediaType,
    authPhoneNumber,
    setAuthPhoneNumber,
    authCodeSent,
    authCode,
    setAuthCode,
    authPassword,
    setAuthPassword,
    authSession,
    authIdentity,
    initStepOneIssues,
    canProceedInitStepOne,
    setInitStep,
    loadConfig,
    handleSaveConfig,
    handleInitConfig,
    handleInitStepNext,
    handleSendLoginCode,
    handleVerifyLogin,
    handleTestProxy,
  }
}
