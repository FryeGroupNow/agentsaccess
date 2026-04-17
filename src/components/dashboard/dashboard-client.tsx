'use client'

import { useState, useEffect, useRef } from 'react'
import { BuyCreditsModal } from './buy-credits-modal'
import { CashoutModal } from './cashout-modal'
import { Button } from '@/components/ui/button'
import { Zap, ArrowUpRight, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCreditsRefresh } from '@/lib/credits-refresh'

interface DashboardClientProps {
  isHuman: boolean
  creditsPurchased?: boolean
  redeemableBalance?: number
  phoneVerified?: boolean
}

export function DashboardClient({ isHuman, creditsPurchased, redeemableBalance = 0, phoneVerified = false }: DashboardClientProps) {
  const { notifyCreditsChanged } = useCreditsRefresh()
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [showCashoutModal, setShowCashoutModal] = useState(false)
  const [cashoutSuccess, setCashoutSuccess] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // When we land on the dashboard with ?credits_purchased=true (Stripe
  // checkout redirect), the Stripe webhook has already credited the wallet
  // server-side — the server component render has the new balance. Nudge
  // any client caches (navbar) and toast the user. Only fire once per mount.
  const firedStripeToast = useRef(false)
  useEffect(() => {
    if (!creditsPurchased || firedStripeToast.current) return
    firedStripeToast.current = true
    notifyCreditsChanged({
      title: 'Credits added to your account',
      description: 'Your wallet balance has been updated.',
      tone: 'success',
    })
  }, [creditsPurchased, notifyCreditsChanged])

  async function handleSignOut() {
    try {
      // Server cookie clear first — this is the one that actually matters
      // for server components and API routes.
      await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' })
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Ignore — about to hard-reload.
    }
    window.location.replace('/')
  }

  return (
    <>
      {creditsPurchased && !dismissed && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center px-4 pt-2 pointer-events-none">
          <div className="flex items-center gap-2 bg-green-600 text-white text-sm px-5 py-2.5 rounded-full shadow-lg pointer-events-auto">
            <Zap className="w-4 h-4" />
            Credits added to your account!
            <button onClick={() => setDismissed(true)} className="ml-2 opacity-70 hover:opacity-100 text-white font-bold">×</button>
          </div>
        </div>
      )}

      {cashoutSuccess && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center px-4 pt-2 pointer-events-none">
          <div className="flex items-center gap-2 bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-full shadow-lg pointer-events-auto">
            <ArrowUpRight className="w-4 h-4" />
            Cashout request submitted! We&apos;ll pay within 3–5 business days.
            <button onClick={() => setCashoutSuccess(false)} className="ml-2 opacity-70 hover:opacity-100 text-white font-bold">×</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 w-full sm:w-auto">
        {isHuman && (
          <>
            {redeemableBalance >= 100 && phoneVerified && (
              <Button
                onClick={() => setShowCashoutModal(true)}
                size="sm"
                variant="ghost"
                className="flex-1 sm:flex-none min-h-[40px] sm:min-h-0"
              >
                <ArrowUpRight className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Cash out
              </Button>
            )}
            <Button
              onClick={() => setShowBuyModal(true)}
              size="sm"
              variant="secondary"
              className="flex-1 sm:flex-none min-h-[40px] sm:min-h-0"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
              Buy Credits
            </Button>
          </>
        )}
        <button
          onClick={handleSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="p-2 sm:p-1.5 w-11 h-11 sm:w-auto sm:h-auto flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {showBuyModal && <BuyCreditsModal onClose={() => setShowBuyModal(false)} />}
      {showCashoutModal && (
        <CashoutModal
          redeemableBalance={redeemableBalance}
          onClose={() => setShowCashoutModal(false)}
          onSubmitted={() => setCashoutSuccess(true)}
        />
      )}
    </>
  )
}
