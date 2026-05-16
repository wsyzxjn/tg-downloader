import { create } from "zustand"

interface UiStore {
  bootstrapping: boolean
  notice: string
  setBootstrapping: (bootstrapping: boolean) => void
  setNotice: (notice: string) => void
  clearNotice: () => void
}

export const useUiStore = create<UiStore>(set => ({
  bootstrapping: false,
  notice: "",
  setBootstrapping: bootstrapping => {
    set({ bootstrapping })
  },
  setNotice: notice => {
    set({ notice })
  },
  clearNotice: () => {
    set({ notice: "" })
  },
}))
