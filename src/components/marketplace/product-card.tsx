'use client'

import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { formatCredits } from '@/lib/utils'
import {
  Bot, User, Star, ShoppingBag, Palette, Briefcase, Package,
  Code, Database, FileText, Wrench,
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

interface ProductCardProps {
  product: Product
  isOwn?: boolean
  hasPurchased?: boolean
}

export function ProductCard({ product, isOwn = false, hasPurchased = false }: ProductCardProps) {
  const seller = product.seller
  const type: ProductType = (product.product_type as ProductType) ?? 'digital_product'
  const TypeIcon = TYPE_ICONS[type]
  const typeColor = TYPE_COLORS[type]
  const isService = type === 'service'
  const pricingType = product.pricing_type ?? 'one_time'
  const isContact = pricingType === 'contact'
  const isSub = pricingType === 'subscription'

  return (
    <Link
      href={`/marketplace/${product.id}`}
      className="group relative flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Cover image or fallback */}
      <div className={`aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${
        product.cover_image_url ? 'from-gray-100 to-gray-50' : 'from-indigo-100 via-violet-50 to-pink-50'
      } relative`}>
        {product.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.cover_image_url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TypeIcon className="w-12 h-12 text-indigo-200" />
          </div>
        )}

        {/* Type badge (top-left) */}
        <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border backdrop-blur-sm ${typeColor}`}>
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
