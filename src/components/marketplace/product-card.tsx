'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { formatCredits } from '@/lib/utils'
import {
  Bot, User, Star, ShoppingBag, Palette, Briefcase, Package,
  Code, Database, FileText, Wrench, Trash2,
} from 'lucide-react'
import { PRODUCT_TYPE_LABELS, type Product, type ProductType } from '@/types'
import { ReputationBadge } from '@/components/ui/reputation-badge'

const TYPE_ICONS: Record<ProductType, React.ComponentType<{ className?: string }>> = {
  digital_product: Package,
  service:         Briefcase,
  template:        FileText,
  tool:            Wrench,
  api:             Code,
  dataset:         Database,
  digital_art:     Palette,
}

const TYPE_COLORS: Record<ProductType, string> = {
  digital_product: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  service:         'bg-amber-50 text-amber-700 border-amber-100',
  template:        'bg-sky-50 text-sky-700 border-sky-100',
  tool:            'bg-emerald-50 text-emerald-700 border-emerald-100',
  api:             'bg-violet-50 text-violet-700 border-violet-100',
  dataset:         'bg-cyan-50 text-cyan-700 border-cyan-100',
  digital_art:     'bg-pink-50 text-pink-700 border-pink-100',
}

// Per-type cover gradient + ink color for the fallback cover art. The
// gradients echo TYPE_COLORS so a product without an uploaded image still
// feels "branded" for its category rather than anonymous.
const COVER_FALLBACK: Record<ProductType, { gradient: string; ink: string; initialBg: string }> = {
  digital_product: { gradient: 'from-indigo-500 via-indigo-400 to-violet-500', ink: 'text-white/90', initialBg: 'bg-white/15'  },
  service:         { gradient: 'from-amber-400 via-orange-400 to-rose-400',    ink: 'text-white/95', initialBg: 'bg-white/20'  },
  template:        { gradient: 'from-sky-500 via-sky-400 to-blue-500',         ink: 'text-white/90', initialBg: 'bg-white/15'  },
  tool:            { gradient: 'from-emerald-500 via-teal-400 to-cyan-500',    ink: 'text-white/90', initialBg: 'bg-white/15'  },
  api:             { gradient: 'from-violet-600 via-purple-500 to-fuchsia-500',ink: 'text-white/90', initialBg: 'bg-white/15'  },
  dataset:         { gradient: 'from-cyan-500 via-teal-500 to-emerald-500',    ink: 'text-white/90', initialBg: 'bg-white/15'  },
  digital_art:     { gradient: 'from-pink-500 via-rose-400 to-orange-400',     ink: 'text-white/95', initialBg: 'bg-white/20'  },
}

// 1×1 transparent PNG encoded as SVG dot pattern — lightweight CSS-only
// texture overlay that adds depth without a network request.
const COVER_DOTS =
  'radial-gradient(circle, rgba(255,255,255,0.22) 1px, transparent 1px)'

/**
 * Fallback cover art for products without an uploaded image. Composed of:
 *   - type-specific gradient background
 *   - large typographic initial (first character of the product title)
 *   - soft dotted overlay for texture
 *   - decorative type icon tucked bottom-right
 *
 * Looks intentional rather than empty — a renter browsing the marketplace
 * should see a set of polished cards whether or not each seller uploaded
 * a cover image.
 */
function ProductCoverFallback({
  title,
  type,
}: {
  title: string
  type: ProductType
}) {
  const theme = COVER_FALLBACK[type]
  const TypeIcon = TYPE_ICONS[type]
  const firstChar = title.trim().charAt(0).toUpperCase() || '·'
  return (
    <div className={`w-full h-full relative bg-gradient-to-br ${theme.gradient}`}>
      {/* Dot-grid overlay for texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: COVER_DOTS, backgroundSize: '14px 14px' }}
      />

      {/* Soft radial highlight, top-left */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 15%, rgba(255,255,255,0.35), transparent 55%)',
        }}
      />

      {/* Large initial — the dominant graphic element */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`flex items-center justify-center w-24 h-24 rounded-2xl backdrop-blur-sm ${theme.initialBg} ring-1 ring-white/25 shadow-xl`}
        >
          <span className={`text-5xl font-black tracking-tight ${theme.ink}`}>
            {firstChar}
          </span>
        </div>
      </div>

      {/* Decorative type glyph, bottom-right — signals "this is a
          [template / API / dataset / …]" without crowding the initial. */}
      <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center">
        <TypeIcon className="w-4 h-4 text-white/90" />
      </div>
    </div>
  )
}

interface ProductCardProps {
  product: Product
  isOwn?: boolean
  hasPurchased?: boolean
}

export function ProductCard({ product, isOwn = false, hasPurchased = false }: ProductCardProps) {
  const router = useRouter()
  const [deleted, setDeleted] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const seller = product.seller
  const type: ProductType = (product.product_type as ProductType) ?? 'digital_product'
  const TypeIcon = TYPE_ICONS[type]
  const typeColor = TYPE_COLORS[type]
  const isService = type === 'service'
  const pricingType = product.pricing_type ?? 'one_time'
  const isContact = pricingType === 'contact'
  const isSub = pricingType === 'subscription'

  // Soft-delete via DELETE /api/products/[id], which sets is_active=false.
  // We hide the card immediately and refresh the route so any list query
  // re-runs without the deleted product. The button lives inside the Link
  // wrapper so every handler must stopPropagation to avoid navigating.
  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(body?.error ?? 'Delete failed')
      } else {
        setDeleted(true)
        router.refresh()
      }
    } catch {
      setDeleteError('Network error')
    } finally {
      setDeleting(false)
    }
  }

  function startConfirm(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(true)
  }

  function cancelConfirm(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(false)
  }

  if (deleted) return null

  return (
    <Link
      href={`/marketplace/${product.id}`}
      className="group relative flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Owner-only delete control. Top-right of the card with the highest
          z-index so it sits above the Featured pill (the seller doesn't
          need to admire their own Featured badge in the marketplace
          listing). Lives inside the Link wrapper so every click handler
          stopPropagation to avoid navigating to the product page. */}
      {isOwn && (
        <div className="absolute top-2 right-2 z-30 flex flex-col items-end gap-1">
          {!confirming ? (
            <button
              onClick={startConfirm}
              title="Delete listing"
              className="rounded-full bg-white/95 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 hover:border-red-200 p-1.5 shadow-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-white/95 border border-red-200 shadow-sm pl-2.5 pr-1 py-1">
              <span className="text-[10px] font-semibold text-red-700">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
              >
                {deleting ? '…' : 'Yes'}
              </button>
              <button
                onClick={cancelConfirm}
                className="text-[10px] font-semibold text-gray-600 hover:text-gray-900 px-1.5"
              >
                No
              </button>
            </div>
          )}
          {deleteError && (
            <span className="text-[10px] font-medium text-red-700 bg-white/95 border border-red-200 rounded-full px-2 py-0.5 shadow-sm max-w-[140px] truncate">
              {deleteError}
            </span>
          )}
        </div>
      )}

      {/* Cover image or branded fallback */}
      <div className="aspect-[16/10] w-full overflow-hidden relative bg-gray-50">
        {product.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.cover_image_url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <ProductCoverFallback title={product.title} type={type} />
        )}

        {/* Type badge (top-left). When sitting on top of the colored fallback
            cover we invert to a translucent white pill so it stays legible. */}
        <span
          className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border backdrop-blur-sm ${
            product.cover_image_url
              ? typeColor
              : 'bg-white/25 text-white border-white/30'
          }`}
        >
          <TypeIcon className="w-3 h-3" />
          {PRODUCT_TYPE_LABELS[type]}
        </span>

        {/* Featured / own / purchased corner */}
        {product.is_featured && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500 text-white shadow">
            <Star className="w-3 h-3 fill-white" /> Featured
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
          {product.title}
        </h3>

        {/* Tagline */}
        {product.tagline && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{product.tagline}</p>
        )}

        {/* Rating */}
        {product.review_count > 0 && product.average_rating != null && (
          <div className="flex items-center gap-1 text-xs">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-gray-700">{product.average_rating.toFixed(1)}</span>
            <span className="text-gray-400">({product.review_count})</span>
          </div>
        )}

        {/* Seller + price footer */}
        <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between gap-2">
          {seller ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar name={seller.display_name} src={seller.avatar_url} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate flex items-center gap-1">
                  {seller.display_name}
                  {seller.user_type === 'agent'
                    ? <Bot className="w-3 h-3 text-violet-500 shrink-0" />
                    : <User className="w-3 h-3 text-gray-400 shrink-0" />}
                </p>
                <div className="flex items-center gap-1">
                  <ReputationBadge score={seller.reputation_score} size="sm" />
                </div>
              </div>
            </div>
          ) : <div />}

          <div className="text-right shrink-0">
            {isContact ? (
              <span className="text-xs font-bold text-gray-700">Contact</span>
            ) : (
              <>
                <p className="text-sm font-bold text-indigo-600 leading-tight">
                  {formatCredits(product.price_credits)}
                  {isSub && <span className="text-[10px] font-normal text-gray-400">/period</span>}
                </p>
                <p className="text-[10px] text-gray-400 leading-tight">
                  ${(product.price_credits * 0.1).toFixed(2)}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {isOwn && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              Your listing
            </span>
          )}
          {hasPurchased && !isOwn && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              Purchased
            </span>
          )}
          {product.purchase_count > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <ShoppingBag className="w-2.5 h-2.5" />
              {product.purchase_count} {isService ? 'hired' : 'sold'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
