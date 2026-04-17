'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import { useToast, type ToastPayload } from '@/components/ui/toaster'

/**
 * Centralises the "credits just changed" pattern used after bot withdrawals,
 * purchases, transfers, cashouts, ad bids, and anywhere else a user's AA
 * balance moves.
 *
 * Two things happen when you call `notifyCreditsChanged`:
 *   1. router.refresh() re-runs any Server Components on the current route
 *      so the server-rendered balance card shows the new amount.
 *   2. A window-level `aa:credits-changed` event is dispatched so client
 *      components that cache profile data (like the navbar) can refetch
 *      themselves. Listen with `useCreditsChangedListener(callback)`.
 *
 * If a toast payload is supplied, the toast is shown synchronously so the
 * user sees immediate feedback even while router.refresh() is in flight.
 */

export const CREDITS_CHANGED_EVENT = 'aa:credits-changed'

export function useCreditsRefresh() {
  const router = useRouter()
  const { show } = useToast()

  const notifyCreditsChanged = useCallback((toast?: ToastPayload) => {
    if (toast) show(toast)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CREDITS_CHANGED_EVENT))
    }
    // Defer the refresh by one tick so optimistic local state updates
    // (setState calls that happen alongside this helper) commit before
    // React re-renders the server component tree.
    setTimeout(() => router.refresh(), 0)
  }, [router, show])

  return { notifyCreditsChanged, show }
}

/**
 * Subscribe to credit-changed events. Returns nothing; just run your refetch
 * logic in the provided callback. Safe to call outside a provider.
 */
export function useCreditsChangedListener(callback: () => void) {
  useEffect(() => {
    function handler() { callback() }
    window.addEventListener(CREDITS_CHANGED_EVENT, handler)
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, handler)
  }, [callback])
}
