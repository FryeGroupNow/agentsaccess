'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, X, AlertTriangle } from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import { DurationPicker, formatMinutes } from './duration-picker'
import { useCreditsRefresh } from '@/lib/credits-refresh'

/**
 * Renter-side countdown timer + expiration prompt for an active bot rental.
 *
 * Two pieces rolled into one file so the state (ticking clock, "already
 * dismissed this prompt" flag) doesn't have to ping-pong through parent props:
 *   • <RentalTimer /> — compact countdown pill for headers and toolbars
 *   • the component internally renders an <ExtendModal /> overlay when the
 *     renter clicks "extend" or when the 2-minute-before-expiry auto-prompt
 *     fires. The prompt only fires once per expiry so we don't nag the user.
 */

interface TimerProps {
  rentalId: string
  botId: string
  expiresAt: string
  status: 'active' | 'ended'
  isRenter: boolean
  onExtended: (newExpiresAt: string) => void
  onEnded: () => void
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export function RentalTimer({ rentalId, botId, expiresAt, status, isRenter, onExtended, onEnded }: TimerProps) {
  const [now, setNow] = useState(() => Date.now())
  const [showModal, setShowModal] = useState<'extend' | 'prompt' | null>(null)
  const lastPromptedFor = useRef<string | null>(null)

  useEffect(() => {
    if (status !== 'active') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status])

  const expiresMs = new Date(expiresAt).getTime()
  const remainingMs = expiresMs - now
  const remainingSec = Math.max(0, Math.floor(remainingMs / 1000))

  // Auto-prompt 2 minutes before expiration — once per expiry timestamp so
  // repeated re-renders don't repeatedly re-open the modal.
  useEffect(() => {
    if (!isRenter) return
    if (status !== 'active') return
    if (remainingMs <= 0) return
    if (remainingMs > 120_000) return
    if (lastPromptedFor.current === expiresAt) return
    lastPromptedFor.current = expiresAt
    setShowModal('prompt')
  }, [remainingMs, expiresAt, isRenter, status])

  // Auto-end when the clock hits zero. Use a separate effect so the expire
  // call fires exactly once per expiry.
  const endedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isRenter) return
    if (status !== 'active') return
    if (remainingMs > 0) return
    if (endedForRef.current === expiresAt) return
    endedForRef.current = expiresAt
    onEnded()
  }, [remainingMs, expiresAt, isRenter, status, onEnded])

  if (status !== 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
        <Clock className="w-3 h-3" /> Ended
      </span>
    )
  }

  const mins = Math.floor(remainingSec / 60)
  const secs = remainingSec % 60
  const warn  = remainingSec <= 120
  const label = mins >= 60
    ? `${Math.floor(mins / 60)}h ${pad(mins % 60)}m`
    : `${pad(mins)}:${pad(secs)}`

  return (
    <>
      <button
        type="button"
        onClick={() => isRenter && setShowModal('extend')}
        disabled={!isRenter}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold transition-colors ${
          warn
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        } ${isRenter ? 'cursor-pointer' : 'cursor-default'}`}
        title={isRenter ? 'Extend rental' : 'Time remaining'}
      >
        <Clock className="w-3 h-3" /> {label}
      </button>

      {showModal && isRenter && (
        <RentalExtendModal
          rentalId={rentalId}
          botId={botId}
          mode={showModal}
          remainingSec={remainingSec}
          onClose={() => setShowModal(null)}
          onExtended={(newExpiresAt) => { setShowModal(null); onExtended(newExpiresAt) }}
          onEndNow={() => { setShowModal(null); onEnded() }}
        />
      )}
    </>
  )
}

// ── Extend / prompt modal ────────────────────────────────────────────────────

interface ExtendProps {
  rentalId: string
  botId: string
  mode: 'extend' | 'prompt'
  remainingSec: number
  onClose: () => void
  onExtended: (newExpiresAt: string) => void
  onEndNow: () => void
}

function RentalExtendModal({
  rentalId, botId, mode, remainingSec, onClose, onExtended, onEndNow,
}: ExtendProps) {
  const { notifyCreditsChanged } = useCreditsRefresh()
  const [minutes, setMinutes] = useState(15)
  const [quote, setQuote] = useState<{ cost_aa: number; fee_aa: number; owner_gets_aa: number } | null>(null)
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

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/rentals/${rentalId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_minutes: minutes }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to extend'); return }
      notifyCreditsChanged({
        title: `Extended rental by ${formatMinutes(minutes)}`,
        description: `Charged ${formatCredits(data.cost_aa ?? quote?.cost_aa ?? 0)}.`,
        tone: 'success',
      })
      onExtended(data.new_expires_at)
    } finally {
      setLoading(false)
    }
  }

  const minsLeft = Math.max(0, Math.ceil(remainingSec / 60))

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="flex items-center gap-2">
            {mode === 'prompt'
              ? <AlertTriangle className="w-5 h-5 text-amber-500" />
              : <Clock className="w-5 h-5 text-indigo-500" />}
            <div>
              <h3 className="font-semibold text-gray-900">
                {mode === 'prompt' ? 'Rental expiring soon' : 'Extend rental'}
              </h3>
              {mode === 'prompt' && (
                <p className="text-xs text-amber-700 mt-0.5">
                  Your rental ends in {minsLeft} minute{minsLeft === 1 ? '' : 's'}.
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-gray-700 block mb-2">
            Add how much time?
          </label>
          <DurationPicker minutes={minutes} onChange={setMinutes} />
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Additional time</span>
            <span className="font-medium">{formatMinutes(minutes)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Cost</span>
            <span className="font-medium">{quote ? formatCredits(quote.cost_aa) : '…'}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Platform fee (5%)</span>
            <span>{quote ? formatCredits(quote.fee_aa) : '…'}</span>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button onClick={submit} disabled={loading || !quote} className="w-full">
            {loading
              ? 'Extending…'
              : quote
                ? `Pay ${formatCredits(quote.cost_aa)} to extend ${formatMinutes(minutes)}`
                : 'Calculating…'}
          </Button>
          {mode === 'prompt' && (
            <Button
              variant="secondary"
              className="w-full text-red-600 hover:bg-red-50"
              onClick={onEndNow}
              disabled={loading}
            >
              End rental now
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {mode === 'prompt' ? 'Dismiss' : 'Cancel'}
          </Button>
        </div>

        <p className="text-[11px] text-gray-400 mt-3 text-center">
          Ending early does <strong>not</strong> refund unused time — the bot was reserved for you.
        </p>
      </Card>
    </div>
  )
}
