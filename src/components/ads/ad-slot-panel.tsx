'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Megaphone, ExternalLink, ShoppingBag, Sparkles } from 'lucide-react'
import type { SlotState } from '@/types'

interface AdSlotPanelProps {
  slot: SlotState
  sharp?: boolean
}

// Module-scoped one-shot fetch shared across every empty slot on the page.
// Without this each panel would fire its own /api/ads/filler request — six
// duplicate calls on /feed alone.
interface FillerProduct {
  id: string
  title: string
  tagline: string | null
  price_credits: number
  cover_image_url: string | null
  seller: { username: string; display_name: string } | null
}
let fillerCache: Promise<FillerProduct[]> | null = null
function loadFillerProducts(): Promise<FillerProduct[]> {
  if (!fillerCache) {
    fillerCache = fetch('/api/ads/filler', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d: { products?: FillerProduct[] }) => d.products ?? [])
      .catch(() => [])
  }
  return fillerCache
}

const ROTATION_MS = 9000

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

  // ─── Empty slot: rotating "house" content + bid CTA ───────────────────────
  if (!placement) {
    return (
      <RotatingFillerSlot
        slotId={slot.slot_id}
        promoteHref={promoteHref}
        topBidLabel={topBidLabel}
        rounded={r}
      />
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

// ─── Filler rotation ─────────────────────────────────────────────────────────
//
// When a slot has no winning bid, cycle through a "Bid for this slot" promo
// card and the platform's top products on a 9-second timer. Each panel uses
// a phase offset based on its slot id so adjacent slots don't all flip at
// the same instant — keeps the page feeling alive instead of strobed.

interface RotatingFillerSlotProps {
  slotId: number
  promoteHref: string
  topBidLabel: string
  rounded: string
}

function RotatingFillerSlot({ slotId, promoteHref, topBidLabel, rounded }: RotatingFillerSlotProps) {
  const [products, setProducts] = useState<FillerProduct[]>([])
  const [step, setStep] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadFillerProducts().then((list) => {
      if (!cancelled) setProducts(list)
    })
    return () => { cancelled = true }
  }, [])

  // Total rotation length: the bid CTA card + every loaded product. If
  // products is empty, the CTA is the only step (no rotation needed).
  const totalSteps = 1 + products.length

  useEffect(() => {
    if (totalSteps <= 1) return
    // Stagger initial step by slotId so neighbouring slots don't sync.
    setStep((slotId % totalSteps + totalSteps) % totalSteps)
    const t = setInterval(() => {
      setStep((s) => (s + 1) % totalSteps)
    }, ROTATION_MS)
    return () => clearInterval(t)
  }, [slotId, totalSteps])

  // Step 0: bid CTA. Steps 1+: filler products (offset by 1).
  const showCta = step === 0 || products.length === 0
  if (showCta) {
    return (
      <Link
        href={promoteHref}
        className={`flex flex-col items-center justify-center gap-2 ${rounded} border border-indigo-400/30 bg-gradient-to-br from-indigo-800/50 via-violet-900/40 to-indigo-950/70 hover:from-indigo-700/60 hover:border-indigo-300 transition-all cursor-pointer group w-full h-full p-4 text-center relative overflow-hidden`}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 60%)' }} />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-white/15 group-hover:bg-white/25 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 transition-colors">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-bold text-white leading-tight px-1">
            Your product here
          </p>
          <p className="text-[10px] text-indigo-200 leading-tight">
            Bid from {topBidLabel}
          </p>
          <span className="text-[10px] font-semibold text-indigo-700 bg-white group-hover:bg-indigo-50 px-3 py-1 rounded-full transition-colors flex items-center gap-1">
            Start bidding
            <ExternalLink className="w-2.5 h-2.5" />
          </span>
        </div>
      </Link>
    )
  }

  const product = products[(step - 1) % products.length]
  return (
    <Link
      href={`/marketplace/${product.id}`}
      className={`group relative flex flex-col ${rounded} border border-white/10 bg-gray-900 overflow-hidden w-full h-full hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300`}
    >
      {/* Featured ribbon — distinct from "Sponsored" so users know this is
          a house pick, not a paid placement. */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-2.5 py-1.5 flex items-center justify-between pointer-events-none">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/90 inline-flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" />
          Featured
        </span>
        <ExternalLink className="w-3 h-3 text-white/80 group-hover:text-white" />
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-indigo-800 via-violet-800 to-pink-700 shrink-0">
        {product.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.cover_image_url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-white/30" />
          </div>
        )}
      </div>

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

      {/* Tiny rotation pip indicator — top-right, under the ribbon */}
      <div className="absolute bottom-2 right-2 flex gap-1 z-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`block w-1 h-1 rounded-full transition-colors ${
              i === step ? 'bg-indigo-300' : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </Link>
  )
}
