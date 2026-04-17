'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowDownToLine, X, Sparkles } from 'lucide-react'
import { formatCredits, formatCreditsWithUSD, parseBalances } from '@/lib/utils'
import { useCreditsRefresh } from '@/lib/credits-refresh'

interface Props {
  botId: string
  botUsername: string
  creditBalance: number
  bonusBalance: number
  /** Owner's credit_balance before withdrawal — used to compute the new-balance toast. */
  ownerCreditBalance?: number
  onClose: () => void
  /**
   * Fires after a successful withdrawal with the amount moved so the parent
   * can update its local bot balance without needing a full refetch.
   */
  onWithdrawn: (amount: number) => void
}

/**
 * Owner-initiated credit pull from a bot into their own wallet.
 *
 * Only Redeemable AA moves. Starter AA on the bot is non-transferable and
 * stays behind — this component displays it so the owner understands why
 * the withdrawable number is smaller than the total.
 */
export function BotWithdrawModal({
  botId, botUsername, creditBalance, bonusBalance,
  ownerCreditBalance = 0, onClose, onWithdrawn,
}: Props) {
  const { total, redeemable, starter } = parseBalances(creditBalance, bonusBalance)
  const { notifyCreditsChanged } = useCreditsRefresh()

  const [amount, setAmount] = useState<string>(redeemable > 0 ? String(redeemable) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<number | null>(null)

  const parsed = Number(amount)
  const invalid = !Number.isFinite(parsed) || parsed <= 0 || parsed > redeemable
  const canSubmit = !invalid && !loading

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (invalid) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/bots/${botId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.floor(parsed) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Withdrawal failed'); return }
      const moved = Math.floor(parsed)
      setSuccess(moved)
      onWithdrawn(moved)
      const newOwnerBalance = ownerCreditBalance + moved
      notifyCreditsChanged({
        title: `Withdrew ${formatCredits(moved)} from @${botUsername}`,
        description: `New balance: ${formatCredits(newOwnerBalance)}`,
        tone: 'success',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4 text-indigo-500" />
              Withdraw from @{botUsername}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Move Redeemable AA into your own account. No platform fee.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        {/* Balance summary */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Bot total balance</span>
            <span className="font-medium text-gray-900">{formatCreditsWithUSD(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Redeemable (withdrawable)</span>
            <span className="font-semibold text-indigo-600">{formatCredits(redeemable)}</span>
          </div>
          {starter > 0 && (
            <div className="flex justify-between text-xs text-emerald-700">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Starter AA (not transferable)
              </span>
              <span className="font-medium">{formatCredits(starter)}</span>
            </div>
          )}
        </div>

        {success != null ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3">
              <ArrowDownToLine className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Withdrew {formatCredits(success)}
            </p>
            <p className="text-xs text-gray-500">
              Credits are now in your own account. The move is logged in both
              activity feeds.
            </p>
            <Button className="mt-4 w-full" variant="secondary" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Amount (AA)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={redeemable}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setAmount(String(redeemable))}
                  disabled={redeemable <= 0}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500 px-2 rounded-lg border border-indigo-100 hover:bg-indigo-50 disabled:opacity-40"
                >
                  Max
                </button>
              </div>
              {invalid && amount.length > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  {parsed <= 0
                    ? 'Amount must be greater than zero.'
                    : `Bot has only ${formatCredits(redeemable)} of Redeemable AA.`}
                </p>
              )}
              {redeemable === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  This bot has no Redeemable AA. Starter AA cannot be withdrawn.
                </p>
              )}
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={!canSubmit}>
                {loading ? 'Transferring…' : 'Transfer to my account'}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
