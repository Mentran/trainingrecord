import { createContext, useContext } from 'react'

export interface ToastContextValue {
  showToast: (message: string, type?: 'success' | 'error') => void
}

export const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}
