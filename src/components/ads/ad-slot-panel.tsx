'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Megaphone, ExternalLink, ShoppingBag } from 'lucide-react'
import type { SlotState } from '@/types'

interface AdSlotPanelProps {
  slot: SlotState
  sharp?: boolean
}

export function AdSlotPanel({ slot, sharp }: AdSlotPanelProps) {
  const impressionSent = useRef(false)
  const placement = slot.current_placement
  const r = sharp ? '' : 'rounded-2xl'

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

  const topBidLabel = slot.next_period_top_bid > 0 ? `${slot.next_period_top_bid} AA` : '1 AA'
  const promoteHref = `/feed/promote?slot=${slot.slot_id}`

  // ─── Empty slot: call-to-bid ───────────────────────────────────────────────
  if (!placement) {
    return (
      <Link
        href={promoteHref}
        className={`flex flex-col items-center justify-center gap-2 ${r} border-2 border-dashed border-indigo-300/40 bg-gradient-to-b from-indigo-900/40 to-indigo-950/60 hover:from-indigo-800/60 hover:border-indigo-300 transition-all cursor-pointer group w-full h-full p-4 text-center`}
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 group-hover:bg-indigo-500/40 flex items-center justify-center transition-colors">
          <Megaphone className="w-5 h-5 text-indigo-300" />
        </div>
        <p className="text-xs font-bold text-indigo-200 leading-tight px-1">
          Promote your product here
        </p>
        <p className="text-[10px] text-indigo-400 leading-tight">
          Bid starts at {topBidLabel}
        </p>
        <span className="text-[10px] font-semibold text-white bg-indigo-500 group-hover:bg-indigo-400 px-3 py-1 rounded-full transition-colors flex items-center gap-1">
          Start bidding
          <ExternalLink className="w-2.5 h-2.5" />
        </span>
      </Link>
    )
  }

  // ─── Winning ad ────────────────────────────────────────────────────────────
  const product = placement.product
  const href = `/marketplace/${product.id}`
  const cover = product.cover_image_url

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`group relative flex flex-col ${r} border border-indigo-500/30 bg-gray-900 overflow-hidden w-full h-full hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-200`}
    >
      {/* Sponsored ribbon */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-2.5 py-1.5 flex items-center justify-between pointer-events-none">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/90">
          Sponsored
        </span>
        <ExternalLink className="w-3 h-3 text-white/80 group-hover:text-white" />
      </div>

      {/* Cover image or fallback hero area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-indigo-800 via-violet-800 to-pink-700 shrink-0">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-white/30" />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex-1 flex flex-col gap-1 p-3 min-h-0 text-white">
        <p className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-indigo-300 transition-colors">
          {product.title}
        </p>
        {product.tagline && (
          <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
            {product.tagline}
          </p>
        )}
        <div className="mt-auto pt-2 border-t border-white/10 flex items-center justify-between">
          <span className="text-sm font-black text-indigo-300">
            {product.price_credits} AA
          </span>
          {product.seller && (
            <span className="text-[9px] text-gray-500 truncate ml-2">
              @{product.seller.username}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
