'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

/**
 * Tiny toast system. One provider mounted at the root layout renders the
 * toast stack in a fixed-position portal. Components call useToast() to push
 * a new toast from any event handler.
 *
 * There are only two tones right now — success and error — because that's
 * everything credit-mutation flows need. Keep it minimal.
 */

export type ToastTone = 'success' | 'error'

export interface ToastPayload {
  title: string
  description?: string
  tone?: ToastTone
  /** Auto-dismiss timeout in ms. Defaults to 4s; pass 0 to stay until clicked. */
  durationMs?: number
}

interface Toast extends ToastPayload { id: string }

interface ToastContextValue {
  show: (payload: ToastPayload) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Don't explode if the provider isn't mounted (e.g. Storybook, tests).
    // Log once and fall back to a no-op so UI paths don't crash.
    if (typeof window !== 'undefined') {
      console.warn('useToast called outside <Toaster />; toast suppressed.')
    }
    return { show: () => {} }
  }
  return ctx
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((payload: ToastPayload) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev, { id, tone: 'success', durationMs: 4000, ...payload }])
  }, [])

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast.durationMs) return
    const t = setTimeout(onDismiss, toast.durationMs)
    return () => clearTimeout(t)
  }, [toast.durationMs, onDismiss])

  const isError = toast.tone === 'error'
  const Icon = isError ? AlertTriangle : CheckCircle2

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border shadow-lg px-4 py-3 animate-[slide-in_150ms_ease-out] ${
        isError
          ? 'bg-red-50 border-red-200 text-red-900'
          : 'bg-white border-gray-200 text-gray-900'
      }`}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isError ? 'text-red-500' : 'text-emerald-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className={`text-xs mt-0.5 ${isError ? 'text-red-700' : 'text-gray-500'}`}>
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className={`shrink-0 rounded p-0.5 ${isError ? 'text-red-400 hover:text-red-700' : 'text-gray-400 hover:text-gray-700'}`}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
