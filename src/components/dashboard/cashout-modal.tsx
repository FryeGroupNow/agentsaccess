'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { USD_PER_CREDIT } from '@/types'
import { X, ArrowUpRight, Info } from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import { useCreditsRefresh } from '@/lib/credits-refresh'

const MIN_CASHOUT = 100

interface CashoutModalProps {
  redeemableBalance: number
  onClose: () => void
  onSubmitted: () => void
}

export function CashoutModal({ redeemableBalance, onClose, onSubmitted }: CashoutModalProps) {
  const { notifyCreditsChanged } = useCreditsRefresh()
  const [credits, setCredits] = useState<string>('100')
  const [paypalEmail, setPaypalEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const parsed = parseInt(credits) || 0
  const usd = parsed * USD_PER_CREDIT
  const isValid = parsed >= MIN_CASHOUT && parsed <= redeemableBalance

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !paypalEmail.includes('@')) return
    setError(null)
    setLoading(true)
    const res = await fetch('/api/credits/cashout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credits: parsed, paypal_email: paypalEmail }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
    } else {
      onSubmitted()
      onClose()
      notifyCreditsChanged({
        title: `Cashout request: ${formatCredits(parsed)}`,
        description: `New redeemable balance: ${formatCredits(Math.max(0, redeemableBalance - parsed))}`,
        tone: 'success',
      })
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Cash out AA Credits</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Redeemable balance</span>
            <span className="font-semibold text-indigo-600">{redeemableBalance.toLocaleString()} AA</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            = ${(redeemableBalance * USD_PER_CREDIT).toFixed(2)} USD available
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How many AA to cash out?
            </label>
            <div className="relative">
              <input
                type="number"
                min={MIN_CASHOUT}
                max={redeemableBalance}
                step={1}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">AA</span>
            </div>
            {isValid && (
              <p className="mt-1.5 text-sm font-medium text-emerald-600">
                You will receive ${usd.toFixed(2)} USD
              </p>
            )}
            {parsed > 0 && !isValid && (
              <p className="mt-1.5 text-xs text-red-500">
                {parsed < MIN_CASHOUT
                  ? `Minimum cashout is ${MIN_CASHOUT} AA ($${(MIN_CASHOUT * USD_PER_CREDIT).toFixed(2)})`
                  : `Exceeds redeemable balance (${redeemableBalance.toLocaleString()} AA)`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PayPal email
            </label>
            <input
              type="email"
              required
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              placeholder="you@paypal.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div
            className="flex items-start gap-2 cursor-pointer"
            onClick={() => setShowInfo((v) => !v)}
          >
            <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <span className="text-xs text-gray-400 hover:text-gray-600">About cashouts</span>
          </div>
          {showInfo && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-xs text-indigo-800 leading-relaxed">
              Cashout requests are reviewed and paid within 3–5 business days via PayPal.
              Only <strong>Redeemable AA</strong> (purchased credits and earned revenue) can be
              cashed out — Starter AA cannot. Your redeemable balance will be debited when your
              request is approved.
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !isValid || !paypalEmail.includes('@')}
          >
            {loading ? 'Submitting…' : isValid ? `Request $${usd.toFixed(2)} payout` : 'Request cashout'}
          </Button>
        </form>
      </div>
    </div>
  )
}
