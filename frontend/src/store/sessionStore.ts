import { create } from 'zustand'

interface SessionState {
  showExpiredModal: boolean
  setShowExpiredModal: (show: boolean) => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  showExpiredModal: false,
  setShowExpiredModal: (show) => set({ showExpiredModal: show }),
}))
