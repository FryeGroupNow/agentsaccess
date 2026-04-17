'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Clock, X, Zap } from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import { DurationPicker, formatMinutes } from './duration-picker'
import { useCreditsRefresh } from '@/lib/credits-refresh'

interface Props {
  botId: string
  botUsername: string
  onClose: () => void
  onJoined: () => void
}

/**
 * Renter-side modal for joining a rental queue.
 *
 * Two toggles control the flow:
 *   • duration — how long the rental will run once the renter's turn starts
 *   • auto_start — whether credits are escrowed now and the rental starts
 *                  automatically on turn (critical for timezone mismatch)
 *
 * When auto_start is on we also collect a pre-loaded instruction block the
 * bot receives as the first rental message.
 */
export function QueueJoinModal({ botId, botUsername, onClose, onJoined }: Props) {
  const { notifyCreditsChanged } = useCreditsRefresh()
  const [minutes, setMinutes] = useState(60)
  const [autoStart, setAutoStart] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [quote, setQuote] = useState<{ cost_aa: number; fee_aa: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setQuote(null)
    fetch(`/api/rentals/quote?bot_id=${botId}&minutes=${minutes}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled && d) setQuote(d) })
      .catch(() => {/* ignore */})
    return () => { cancelled = true }
  }, [botId, minutes])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/rentals/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: botId,
          duration_minutes: minutes,
          auto_start: autoStart,
          pre_loaded_instructions: autoStart ? instructions.trim() || null : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to join queue'); return }
      if (autoStart && data.pre_charged_aa > 0) {
        // Auto-start reserves credits immediately. Nudge everyone to refetch
        // so the balance badge drops. A plain queue join (no escrow) doesn't
        // move credits yet, so no toast in that branch.
        notifyCreditsChanged({
          title: `Held ${formatCredits(data.pre_charged_aa)} for @${botUsername}`,
          description: 'Your rental will auto-start when the bot is free.',
          tone: 'success',
        })
      }
      onJoined()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Join queue for @{botUsername}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              You&apos;ll be notified the moment it&apos;s your turn.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Rental duration</label>
            <DurationPicker minutes={minutes} onChange={setMinutes} />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-indigo-300 transition-colors">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-indigo-600"
            />
            <div>
              <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Auto-start when it&apos;s my turn
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Credits are charged now. When your turn comes, the rental
                begins immediately — no 5-minute confirmation window. Use
                this if you&apos;ll be asleep, offline, or in another timezone.
              </p>
            </div>
          </label>

          {autoStart && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Pre-loaded instructions (optional)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="When my turn comes, here's what I need done…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Delivered to the bot as the first rental message. Bot can start
                working before you&apos;re even online.
              </p>
            </div>
          )}

          <div className="rounded-lg bg-gray-50 p-3 border border-gray-200 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Duration</span>
              <span className="font-medium">{formatMinutes(minutes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{autoStart ? 'Charged now' : 'Charged on turn'}</span>
              <span className="font-medium">{quote ? formatCredits(quote.cost_aa) : '…'}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Platform fee (5%)</span>
              <span>{quote ? formatCredits(quote.fee_aa) : '…'}</span>
            </div>
          </div>

          {!autoStart && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              You&apos;ll have <strong>5 minutes</strong> to confirm payment
              once your turn arrives, or you lose your spot and the next person
              is promoted.
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading || !quote}>
              {loading
                ? 'Joining queue…'
                : autoStart
                  ? `Hold ${quote ? formatCredits(quote.cost_aa) : '…'} · Join queue`
                  : 'Join queue'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
