'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Megaphone, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SlotState, Product } from '@/types'

interface PromoteModalProps {
  product: Product
  onClose: () => void
}

const SLOT_LABEL: Record<number, string> = {
  1: 'Left 1', 2: 'Left 2', 3: 'Left 3',
  4: 'Right 1', 5: 'Right 2', 6: 'Right 3',
}

function msUntilNextHour(): number {
  const now = Date.now()
  return (Math.floor(now / 3_600_000) + 1) * 3_600_000 - now
}

function formatCountdown(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function PromoteModal({ product, onClose }: PromoteModalProps) {
  const [slots, setSlots] = useState<SlotState[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [bidAmount, setBidAmount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(msUntilNextHour())

  useEffect(() => {
    fetch('/api/ads/slots')
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setLoadingSlots(false))
  }, [])

  // Countdown timer
  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilNextHour()), 1000)
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

  async function handleSubmit(e: React.FormEvent) {
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
      setSuccess(true)
    }
    setSubmitting(false)
  }

  const selectedSlotState = slots.find((s) => s.slot_id === selectedSlot)
  const currentTopBid = selectedSlotState?.next_period_top_bid ?? 0
  const minBid = Math.max(1, currentTopBid + 1)

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
            <h3 className="font-semibold text-gray-900 mb-1">Bid placed!</h3>
            <p className="text-sm text-gray-500 mb-1">
              Your bid of <strong>{bidAmount} AA</strong> is in the queue for{' '}
              <strong>{SLOT_LABEL[selectedSlot!]}</strong>.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              If you win, your ad appears next hour. Losers are refunded automatically.
            </p>
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Auction timer */}
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <p className="text-xs text-amber-800 font-medium">Next auction starts in</p>
              <span className="font-mono text-sm font-bold text-amber-700">{formatCountdown(countdown)}</span>
            </div>

            {/* Slot grid */}
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Choose a slot to bid on (next hour)</p>
              {loadingSlots ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((s) => {
                    const isSelected = selectedSlot === s.slot_id
                    const occupied = !!s.current_placement
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
                          <span className="text-xs font-semibold text-gray-900">{SLOT_LABEL[s.slot_id]}</span>
                          {occupied && (
                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">active</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">
                          {occupied
                            ? s.current_placement!.product.title
                            : 'Empty'}
                        </p>
                        <p className="text-[10px] text-indigo-600 font-medium mt-0.5">
                          Next: {s.next_period_top_bid > 0
                            ? `top bid ${s.next_period_top_bid} AA`
                            : 'no bids yet'
                          }
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bid amount */}
            {selectedSlot != null && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Your bid (AA Credits)
                  {currentTopBid > 0 && (
                    <span className="ml-1 text-gray-400 font-normal">
                      — current top bid: {currentTopBid} AA
                    </span>
                  )}
                </label>
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
                <p className="text-xs text-gray-400 mt-1">
                  Deducted immediately · refunded if outbid · winner keeps the slot for 1 hour
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || selectedSlot == null || bidAmount < minBid}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Placing bid…</>
              ) : (
                `Place bid — ${bidAmount} AA`
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
