'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Clock, X } from 'lucide-react'
import { formatMinutes } from './duration-picker'
import { useCreditsRefresh } from '@/lib/credits-refresh'

type QueueEntry = {
  id: string
  bot_id: string
  renter_id: string
  desired_duration_minutes: number
  auto_start: boolean
  pre_loaded_instructions: string | null
  pre_charged_amount: number
  status: 'waiting' | 'claimed' | 'started' | 'left' | 'expired'
  claim_deadline: string | null
}

interface QueueStatusResponse {
  size: number
  my_position: number | null
  my_entry: QueueEntry | null
}

interface Props {
  botId: string
  botUsername: string
  /** Polling frequency for queue position updates (ms). */
  pollMs?: number
  /** Fires when the caller leaves the queue, so the parent can re-render. */
  onLeft?: () => void
  /** Fires when the caller's auto-start rental has begun. */
  onAutoStarted?: () => void
}

/**
 * Status banner for a renter currently in a bot's queue. Shows:
 *   • current position
 *   • confirm prompt when status flips to 'claimed'
 *   • leave button
 *
 * Polls /api/rentals/queue/[botId] on an interval so position and claim
 * state stay fresh without relying on realtime subscriptions.
 */
export function QueueStatus({ botId, botUsername, pollMs = 5000, onLeft, onAutoStarted }: Props) {
  const { notifyCreditsChanged } = useCreditsRefresh()
  const [status, setStatus] = useState<QueueStatusResponse | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/rentals/queue/${botId}`)
    if (!res.ok) return
    const data = await res.json()
    setStatus(data)

    // If our entry has quietly flipped to 'started' (auto-start fired), let
    // the parent know so it can close this card.
    if (data.my_entry?.status === 'started') {
      onAutoStarted?.()
    }
  }, [botId, onAutoStarted])

  useEffect(() => {
    load()
    const t = setInterval(load, pollMs)
    return () => clearInterval(t)
  }, [load, pollMs])

  async function leave() {
    setLeaving(true)
    setError('')
    try {
      const res = await fetch(`/api/rentals/queue?bot_id=${botId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to leave'); return }
      // If the leaver had auto-start escrow, those credits are refunded by
      // the RPC — let everyone know to refetch the balance.
      if (status?.my_entry?.pre_charged_amount && status.my_entry.pre_charged_amount > 0) {
        notifyCreditsChanged({
          title: 'Left the queue',
          description: 'Pre-held credits were returned to your wallet.',
          tone: 'success',
        })
      }
      onLeft?.()
    } finally {
      setLeaving(false)
    }
  }

  async function confirm() {
    if (!status?.my_entry) return
    setConfirming(true)
    setError('')
    try {
      const res = await fetch('/api/rentals/queue/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue_id: status.my_entry.id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to confirm'); return }
      notifyCreditsChanged({
        title: `Rental confirmed with @${botUsername}`,
        description: 'Your credits have been charged.',
        tone: 'success',
      })
      if (data.rental_id) {
        window.location.href = `/rentals/${data.rental_id}/chat`
      }
    } finally {
      setConfirming(false)
    }
  }

  if (!status?.my_entry) return null
  const entry = status.my_entry
  const position = status.my_position ?? 0

  if (entry.status === 'claimed') {
    const deadline = entry.claim_deadline ? new Date(entry.claim_deadline).getTime() : null
    const secondsLeft = deadline ? Math.max(0, Math.floor((deadline - Date.now()) / 1000)) : null

    return (
      <Card className="p-4 border-amber-200 bg-amber-50">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-1">
              <Clock className="w-4 h-4" /> You&apos;re next — @{botUsername} is available!
            </h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Confirm your {formatMinutes(entry.desired_duration_minutes)} rental
              {secondsLeft != null ? ` within ${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}` : ' now'}
              — or you lose your spot.
            </p>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={confirm} disabled={confirming}>
            {confirming ? 'Confirming…' : 'Confirm & Pay'}
          </Button>
          <Button size="sm" variant="secondary" className="text-red-600" onClick={leave} disabled={leaving}>
            Give up spot
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-3 border-indigo-200 bg-indigo-50 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm text-indigo-900 min-w-0">
        <Clock className="w-4 h-4 shrink-0" />
        <span className="truncate">
          #{position} in queue for @{botUsername} · {formatMinutes(entry.desired_duration_minutes)}
          {entry.auto_start && <span className="ml-1 font-semibold">· auto-start</span>}
        </span>
      </div>
      <button
        onClick={leave}
        disabled={leaving}
        className="text-xs text-indigo-600 hover:text-red-600 font-medium flex items-center gap-0.5 disabled:opacity-50"
      >
        <X className="w-3 h-3" />
        {leaving ? 'Leaving…' : 'Leave'}
      </button>
    </Card>
  )
}
