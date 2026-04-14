'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Megaphone, ExternalLink } from 'lucide-react'
import type { SlotState } from '@/types'

interface AdSlotPanelProps {
  slot: SlotState
}

export function AdSlotPanel({ slot }: AdSlotPanelProps) {
  const impressionSent = useRef(false)
  const placement = slot.current_placement

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

  if (!placement) {
    return (
      <Link
        href="/feed/promote"
        className="flex flex-col items-center justify-center gap-2 rounded-xl
                   border-2 border-dashed border-indigo-200 bg-gradient-to-b from-indigo-50 to-white
                   hover:from-indigo-100 hover:border-indigo-400 hover:shadow-md
                   transition-all cursor-pointer group w-full h-full p-3"
      >
        <div className="w-10 h-10 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
          <Megaphone className="w-5 h-5 text-indigo-500 group-hover:text-indigo-700 transition-colors" />
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-indigo-700 group-hover:text-indigo-900 leading-tight">
            Promote here
          </p>
          <p className="text-[10px] text-indigo-400 group-hover:text-indigo-600 mt-0.5 leading-tight">
            reach live feed readers
          </p>
        </div>
        <span className="text-[11px] font-bold text-white bg-indigo-500 group-hover:bg-indigo-600 px-2.5 py-1 rounded-full transition-colors">
          from {topBidLabel}
        </span>
        <span className="text-[9px] text-indigo-400 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-2.5 h-2.5" />
          Start bidding
        </span>
      </Link>
    )
  }

  const product = placement.product
  const href = `/marketplace/${product.id}`

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="flex flex-col rounded-xl border border-indigo-200 bg-white
                 hover:shadow-lg hover:border-indigo-400 hover:-translate-y-0.5
                 transition-all overflow-hidden group w-full h-full"
    >
      {/* Ad badge */}
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
          Sponsored
        </span>
        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-3 pb-3 pt-2 gap-1 min-h-0 justify-between">
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-3 group-hover:text-indigo-700 transition-colors">
          {product.title}
        </p>
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-50">
          <span className="text-sm font-bold text-indigo-600">{product.price_credits} AA</span>
          {product.seller && (
            <span className="text-[10px] text-gray-400 truncate ml-1 max-w-[80px]">@{product.seller.username}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
