'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MIN_PURCHASE_CREDITS, calcStripeFees } from '@/types'
import { X, Zap, Info } from 'lucide-react'

interface BuyCreditsModalProps {
  onClose: () => void
}

export function BuyCreditsModal({ onClose }: BuyCreditsModalProps) {
  const [credits, setCredits] = useState<string>('100')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFeeInfo, setShowFeeInfo] = useState(false)

  const parsed = parseInt(credits) || 0
  const isValid = parsed >= MIN_PURCHASE_CREDITS && parsed <= 100_000
  const fees = parsed > 0 ? calcStripeFees(parsed) : null

  async function handleCheckout() {
    if (!isValid) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: parsed }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Buy AA Credits</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="mb-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">How many credits?</label>
            <div className="relative">
              <input
                type="number" min={MIN_PURCHASE_CREDITS} max={100_000} step={1}
                value={credits} onChange={(e) => setCredits(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-16"
                placeholder={`Min ${MIN_PURCHASE_CREDITS}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">AA</span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">1 AA Credit = $0.10 redeemable value</p>
          </div>

          {fees && isValid && (
            <div className="rounded-lg border border-gray-200 overflow-hidden text-sm">
              <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Order summary</span>
                <button onClick={() => setShowFeeInfo((v) => !v)} className="text-gray-400 hover:text-indigo-600" title="About fees">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="px-3 py-2.5 space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>{parsed.toLocaleString()} AA Credits</span>
                  <span>${fees.base_usd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>Stripe processing fee (2.9% + $0.30)</span>
                  <span>+${fees.stripe_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-1.5 mt-1">
                  <span>Total charged</span>
                  <span className="text-indigo-600">${fees.total_charged.toFixed(2)}</span>
                </div>
              </div>
              {showFeeInfo && (
                <div className="bg-indigo-50 border-t border-indigo-100 px-3 py-2.5 text-xs text-indigo-800 leading-relaxed">
                  The Stripe processing fee (2.9% + $0.30) is passed through at cost — AgentsAccess charges no markup on credit purchases.
                </div>
              )}
            </div>
          )}

          {parsed > 0 && !isValid && (
            <p className="text-xs text-red-500">
              {parsed < MIN_PURCHASE_CREDITS
                ? `Minimum purchase is ${MIN_PURCHASE_CREDITS} credits ($${(MIN_PURCHASE_CREDITS * 0.10).toFixed(2)})`
                : 'Maximum is 100,000 credits per transaction'}
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <Button className="w-full" onClick={handleCheckout} disabled={loading || !isValid}>
          {loading ? 'Redirecting…' : fees ? `Pay $${fees.total_charged.toFixed(2)}` : 'Continue to payment'}
        </Button>
        <p className="text-xs text-gray-400 text-center mt-3">Secured by Stripe. Credits are added instantly after payment.</p>
      </div>
    </div>
  )
}
