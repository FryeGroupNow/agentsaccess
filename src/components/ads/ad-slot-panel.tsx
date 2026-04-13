'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Megaphone } from 'lucide-react'
import type { SlotState } from '@/types'

interface AdSlotPanelProps {
  slot: SlotState
}

const SLOT_LABELS: Record<number, string> = {
  1: 'L1', 2: 'L2', 3: 'L3',
  4: 'R1', 5: 'R2', 6: 'R3',
}

export function AdSlotPanel({ slot }: AdSlotPanelProps) {
  const impressionSent = useRef(false)
  const placement = slot.current_placement

  // Track impression once per mount
  useEffect(() => {
    if (!placement || impressionSent.current) return
    impressionSent.current = true
    fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement_id: placement.id, type: 'impression' }),
    }).catch(() => {})
  }, [placement])

  function handleClick() {
    if (!placement) return
    fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement_id: placement.id, type: 'click' }),
    }).catch(() => {})
  }

  const topBidLabel = slot.next_period_top_bid > 0
    ? `${slot.next_period_top_bid} AA`
    : '1 AA'

  // Horizontal banner: full sidebar width, fixed height
  if (!placement) {
    return (
      <Link
        href="/feed/promote"
        className="flex items-center justify-center gap-2 rounded-lg
                   border-2 border-dashed border-gray-200 bg-gray-50
                   hover:bg-indigo-50 hover:border-indigo-200 transition-colors
                   cursor-pointer group w-full h-full"
      >
        <div className="flex flex-col items-center gap-1.5 py-2 px-2 text-center">
          <Megaphone className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
          <p className="text-[10px] text-gray-400 group-hover:text-indigo-500 leading-tight">
            Promote here
          </p>
          <span className="text-[9px] font-semibold text-indigo-400 group-hover:text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100 px-1.5 py-0.5 rounded-full">
            from {topBidLabel}
          </span>
        </div>
      </Link>
    )
  }

  const product = placement.product
  const href = `/marketplace/${product.id}`

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="flex flex-col rounded-lg border border-indigo-100 bg-white
                 hover:shadow-md hover:border-indigo-300 transition-all overflow-hidden
                 group w-full h-full"
    >
      {/* Ad badge */}
      <div className="flex items-center justify-between px-2.5 pt-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">
          Ad · {SLOT_LABELS[slot.slot_id]}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-2.5 pb-2 gap-0.5 min-h-0 justify-center">
        <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-indigo-700">
          {product.title}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-bold text-indigo-600">{product.price_credits} AA</span>
          {product.seller && (
            <span className="text-[9px] text-gray-400 truncate ml-1">@{product.seller.username}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
