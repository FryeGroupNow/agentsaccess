'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Megaphone, Check, Zap, TrendingUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SlotState, Product } from '@/types'
import { formatCredits } from '@/lib/utils'
import { useCreditsRefresh } from '@/lib/credits-refresh'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { TOOLTIPS } from '@/lib/tooltips'

interface PromoteModalProps {
  product: Product
  onClose: () => void
  initialSlot?: number
}

const SLOT_LABEL: Record<number, string> = {
  1: 'L1', 2: 'L2', 3: 'L3',
  4: 'R1', 5: 'R2', 6: 'R3',
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function PromoteModal({ product, onClose, initialSlot }: PromoteModalProps) {
  const { notifyCreditsChanged } = useCreditsRefresh()
  const [slots, setSlots] = useState<SlotState[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(initialSlot ?? null)
  const [bidAmount, setBidAmount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ kind: 'instant' | 'bid'; amount: number } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(3600)

  const loadSlots = useCallback(async () => {
    const res = await fetch('/api/ads/slots', { cache: 'no-store' })
    const json = await res.json()
    const next: SlotState[] = json.slots ?? []
    setSlots(next)
    if (next[0]) setSecondsLeft(next[0].seconds_until_settle)
  }, [])

  useEffect(() => {
    loadSlots().finally(() => setLoadingSlots(false))
    // Refresh every 8 seconds so winning/outbid status stays fresh
    const id = setInterval(loadSlots, 8000)
    return () => clearInterval(id)
  }, [loadSlots])

  // Local countdown — ticks each second between server refreshes
  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  // Set minimum bid when slot selected
  useEffect(() => {
    if (selectedSlot == null) return
    const slot = slots.find((s) => s.slot_id === selectedSlot)
    if (!slot) return
    const minBid = Math.max(1, slot.next_period_top_bid + 1)
    setBidAmount(minBid)
  }, [selectedSlot, slots])

  const selectedSlotState = slots.find((s) => s.slot_id === selectedSlot)
  const selectedIsEmpty = selectedSlotState != null && selectedSlotState.current_placement == null
  const currentTopBid = selectedSlotState?.next_period_top_bid ?? 0
  const minBid = Math.max(1, currentTopBid + 1)

  // ── Instant ad: empty slot, 1 AA, live now ──────────────────────────────
  async function handleInstantAd() {
    if (selectedSlot == null) return
    setError(null)
    setSubmitting(true)

    const res = await fetch('/api/ads/instant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: selectedSlot, product_id: product.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to start ad')
      // Refresh slots — maybe someone else just took the slot
      loadSlots()
    } else {
      setSuccess({ kind: 'instant', amount: 1 })
      notifyCreditsChanged({
        title: `Instant ad placed for ${product.title}`,
        description: `Charged ${formatCredits(1)}.`,
        tone: 'success',
      })
    }
    setSubmitting(false)
  }

  // ── Auction bid: next-hour competitive bid ──────────────────────────────
  async function handleBid(e: React.FormEvent) {
    e.preventDefault()
    if (selectedSlot == null) return
    setError(null)
    setSubmitting(true)

    const res = await fetch('/api/ads/bids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot_id: selectedSlot,
        product_id: product.id,
        amount_credits: bidAmount,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to place bid')
    } else {
      setSuccess({ kind: 'bid', amount: bidAmount })
      loadSlots()
      notifyCreditsChanged({
        title: `Bid placed: ${formatCredits(bidAmount)}`,
        description: `Bidding on ${product.title}. Charged now, refunded if outbid.`,
        tone: 'success',
      })
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Promote listing</h2>
              <p className="text-xs text-gray-500 truncate max-w-[280px]">{product.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            {success.kind === 'instant' ? (
              <>
                <h3 className="font-semibold text-gray-900 mb-1">Ad is live</h3>
                <p className="text-sm text-gray-500 mb-1">
                  Your ad started in <strong>{SLOT_LABEL[selectedSlot!]}</strong> for{' '}
                  <strong>{success.amount} AA</strong>. It will run until the end of the hour.
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  Refresh the feed to see it in the slot.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-gray-900 mb-1">Bid placed</h3>
                <p className="text-sm text-gray-500 mb-1">
                  Your bid of <strong>{success.amount} AA</strong> is in the queue for{' '}
                  <strong>{SLOT_LABEL[selectedSlot!]}</strong>.
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  If you win the next-hour auction, your ad goes live automatically. Losers are refunded.
                </p>
              </>
            )}
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Auction timer */}
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <p className="text-xs text-amber-800 font-medium">Next-hour auction settles in</p>
              <span className="font-mono text-sm font-bold text-amber-700">{formatCountdown(secondsLeft)}</span>
            </div>

            {/* Slot grid */}
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Pick a slot</p>
              {loadingSlots ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((s) => {
                    const isSelected = selectedSlot === s.slot_id
                    const occupied = !!s.current_placement
                    const myStatus = s.my_bid_status
                    return (
                      <button
                        key={s.slot_id}
                        type="button"
                        onClick={() => setSelectedSlot(s.slot_id)}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-900">{SLOT_LABEL[s.slot_id]}</span>
                          <div className="flex items-center gap-1">
                            {occupied ? (
                              <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                Live
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                Empty
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Currently running */}
                        {occupied && s.current_placement && (
                          <p className="text-[10px] text-gray-500 truncate">
                            Now: {s.current_placement.product.title} ({s.current_winning_bid} AA)
                          </p>
                        )}

                        {/* Next auction */}
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="text-gray-500">
                            Next: {s.next_period_top_bid > 0
                              ? `${s.next_period_top_bid} AA`
                              : 'no bids'}
                          </span>
                          {s.next_period_bid_count > 0 && (
                            <span className="text-gray-400 flex items-center gap-0.5">
                              <Users className="w-2.5 h-2.5" />
                              {s.next_period_bid_count}
                            </span>
                          )}
                        </div>

                        {/* My bid status */}
                        {myStatus && (
                          <p
                            className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${
                              myStatus === 'winning' ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            You: {s.my_bid_amount} AA — {myStatus}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Action area for the selected slot */}
            {selectedSlot != null && selectedSlotState != null && (
              <>
                {selectedIsEmpty ? (
                  // ── EMPTY SLOT: instant ad path ──────────────────────────
                  <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                          Start ad now — 1 AA
                          <InfoTooltip size="sm">{TOOLTIPS.instantAd}</InfoTooltip>
                        </h3>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {SLOT_LABEL[selectedSlot]} is empty this hour. Pay 1 AA and your ad goes live
                          immediately for the rest of the hour. No auction, no waiting.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      disabled={submitting}
                      onClick={handleInstantAd}
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting ad…</>
                      ) : (
                        <><Zap className="w-4 h-4 mr-2" />Start ad now — 1 AA</>
                      )}
                    </Button>
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">Or bid on the next-hour auction →</summary>
                      <form onSubmit={handleBid} className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(Math.max(minBid, parseInt(e.target.value) || minBid))}
                            min={minBid}
                            step={1}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-500 shrink-0">AA</span>
                        </div>
                        <Button type="submit" variant="secondary" className="w-full" disabled={submitting || bidAmount < minBid}>
                          Place next-hour bid — {bidAmount} AA
                        </Button>
                      </form>
                    </details>
                  </div>
                ) : (
                  // ── OCCUPIED SLOT: must bid for next hour ────────────────
                  <form onSubmit={handleBid} className="rounded-xl border-2 border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                          Bid for next hour ({SLOT_LABEL[selectedSlot]})
                          <InfoTooltip size="sm">{TOOLTIPS.adAuction}</InfoTooltip>
                        </h3>
                        <p className="text-xs text-indigo-700 mt-0.5">
                          This slot is currently running an ad. Place a bid for the next-hour
                          auction. Highest bid wins.
                        </p>
                      </div>
                    </div>

                    {/* Bid status row */}
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">
                        Top bid: <strong className="text-gray-800">{currentTopBid > 0 ? `${currentTopBid} AA` : 'none yet'}</strong>
                      </span>
                      <span className="text-gray-500">
                        Bidders: <strong className="text-gray-800">{selectedSlotState.next_period_bid_count}</strong>
                      </span>
                      {selectedSlotState.my_bid_status && (
                        <span
                          className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            selectedSlotState.my_bid_status === 'winning'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {selectedSlotState.my_bid_status}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Your bid (AA)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(Math.max(minBid, parseInt(e.target.value) || minBid))}
                          min={minBid}
                          step={1}
                          required
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-500 shrink-0">AA</span>
                      </div>
                      {currentTopBid > 0 && bidAmount <= currentTopBid && (
                        <p className="text-xs text-amber-600 mt-1">
                          Must exceed current top bid of {currentTopBid} AA
                        </p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting || bidAmount < minBid}>
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Placing bid…</>
                      ) : selectedSlotState.my_bid_status === 'outbid' ? (
                        `Bid higher — ${bidAmount} AA`
                      ) : (
                        `Place bid — ${bidAmount} AA`
                      )}
                    </Button>
                  </form>
                )}
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
