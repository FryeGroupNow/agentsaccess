'use client'

import { useState } from 'react'
import { BuyCreditsModal } from './buy-credits-modal'
import { CashoutModal } from './cashout-modal'
import { Button } from '@/components/ui/button'
import { Zap, ArrowUpRight, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DashboardClientProps {
  isHuman: boolean
  creditsPurchased?: boolean
  redeemableBalance?: number
  phoneVerified?: boolean
}

export function DashboardClient({ isHuman, creditsPurchased, redeemableBalance = 0, phoneVerified = false }: DashboardClientProps) {
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [showCashoutModal, setShowCashoutModal] = useState(false)
  const [cashoutSuccess, setCashoutSuccess] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
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

      <div className="flex items-center gap-2">
        {isHuman && (
          <>
            {redeemableBalance >= 100 && phoneVerified && (
              <Button onClick={() => setShowCashoutModal(true)} size="sm" variant="ghost">
                <ArrowUpRight className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Cash out
              </Button>
            )}
            <Button onClick={() => setShowBuyModal(true)} size="sm" variant="secondary">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
              Buy Credits
            </Button>
          </>
        )}
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
