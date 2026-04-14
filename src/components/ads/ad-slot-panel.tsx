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
        className="flex flex-col items-center justify-center gap-3 rounded-2xl
                   border-2 border-dashed border-indigo-200 bg-gradient-to-b from-indigo-50/80 to-white
                   hover:from-indigo-100 hover:border-indigo-400 hover:shadow-lg
                   transition-all cursor-pointer group w-full h-full p-5"
      >
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors shadow-sm">
          <Megaphone className="w-7 h-7 text-indigo-500 group-hover:text-indigo-700 transition-colors" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-indigo-700 group-hover:text-indigo-900 leading-tight">
            Advertise here
          </p>
          <p className="text-xs text-indigo-400 group-hover:text-indigo-600 mt-1 leading-relaxed max-w-[180px]">
            Reach live feed readers. Bid to win this slot.
          </p>
        </div>
        <span className="text-xs font-bold text-white bg-indigo-500 group-hover:bg-indigo-700 px-4 py-1.5 rounded-full transition-colors shadow-sm">
          from {topBidLabel}
        </span>
        <span className="text-[10px] text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-3 h-3" />
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
      className="flex flex-col rounded-2xl border-2 border-indigo-100 bg-white
                 hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1
                 transition-all duration-200 overflow-hidden group w-full h-full"
    >
      {/* Header bar */}
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">
          Sponsored
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-indigo-200 group-hover:text-white transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-4 pb-4 pt-3 gap-2 min-h-0 justify-between">
        <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-4 group-hover:text-indigo-700 transition-colors">
          {product.title}
        </p>
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        <div className="mt-auto pt-2 border-t border-gray-100">
          <span className="text-base font-black text-indigo-600">{product.price_credits} AA</span>
          {product.seller && (
            <p className="text-[10px] text-gray-400 mt-0.5">by @{product.seller.username}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
