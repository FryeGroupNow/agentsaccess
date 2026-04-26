'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ShoppingBag, Download, Star, MessageSquare, Briefcase, ImageOff } from 'lucide-react'

interface PurchasedProduct {
  id: string
  title: string
  price_credits: number
  category: string | null
  product_type: string | null
  file_url: string | null
  file_name: string | null
  cover_image_url: string | null
  seller_id: string
  seller_username: string | null
  seller_display_name: string | null
}

interface PurchaseRow {
  product_id: string
  created_at: string
  product: PurchasedProduct | null
}

interface Props {
  purchases: PurchaseRow[]
  /** Map of seller_id → resolved conversation id (sorted-pair) so the
   *  "Message seller" link can deep-link straight into the thread. The
   *  dashboard server fetches this; absent entries fall back to the
   *  seller's profile page. */
  conversationsBySeller?: Record<string, string>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * "My Purchases" panel. Surfaces every product the user has bought with
 * the things a buyer typically wants in one click: download (permanent
 * URL), leave a review, message the seller. Service orders also get a
 * "Manage order" deep-link to the services tab so the user can confirm
 * delivery from here.
 */
export function PurchasesPanel({ purchases, conversationsBySeller = {} }: Props) {
  const [imgError, setImgError] = useState<Record<string, boolean>>({})

  if (purchases.length === 0) {
    return (
      <p className="text-xs text-gray-400">Nothing purchased yet — browse the marketplace to find something useful.</p>
    )
  }

  return (
    <div className="space-y-2">
      {purchases.map((p) => {
        const prod = p.product
        if (!prod) return null
        const isService = prod.product_type === 'service'
        const sellerHandle = prod.seller_username
        const conversationId = prod.seller_id ? conversationsBySeller[prod.seller_id] : undefined
        const messageHref = conversationId
          ? `/messages/${conversationId}`
          : sellerHandle
            ? `/profile/${sellerHandle}`
            : '/messages'

        return (
          <div key={p.product_id} className="rounded-lg border border-gray-100 p-2.5 hover:border-indigo-200 transition-colors">
            <div className="flex gap-3">
              {/* Cover thumbnail or fallback tile */}
              <div className="w-16 h-16 rounded-md overflow-hidden bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shrink-0 relative">
                {prod.cover_image_url && !imgError[prod.id] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={prod.cover_image_url}
                    alt={prod.title}
                    className="w-full h-full object-cover"
                    onError={() => setImgError((s) => ({ ...s, [prod.id]: true }))}
                  />
                ) : isService ? (
                  <Briefcase className="w-6 h-6 text-indigo-300" />
                ) : prod.cover_image_url ? (
                  <ImageOff className="w-5 h-5 text-indigo-300" />
                ) : (
                  <ShoppingBag className="w-6 h-6 text-indigo-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <Link
                  href={`/marketplace/${prod.id}`}
                  className="text-sm font-medium text-gray-800 truncate block hover:text-indigo-600"
                >
                  {prod.title}
                </Link>
                <div className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                  <span>Purchased {formatDate(p.created_at)}</span>
                  {sellerHandle && (
                    <>
                      <span>·</span>
                      <Link href={`/profile/${sellerHandle}`} className="hover:text-indigo-600">
                        @{sellerHandle}
                      </Link>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {prod.file_url && (
                    <a
                      href={prod.file_url}
                      download={prod.file_name ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium px-2 py-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  )}
                  {isService && (
                    <Link
                      href="/dashboard?tab=services#services"
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium px-2 py-1"
                    >
                      <Briefcase className="w-3 h-3" />
                      Manage order
                    </Link>
                  )}
                  <Link
                    href={`/marketplace/${prod.id}#review`}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-medium px-2 py-1"
                  >
                    <Star className="w-3 h-3" />
                    Review
                  </Link>
                  <Link
                    href={messageHref}
                    className="inline-flex items-center gap-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 text-[11px] font-medium px-2 py-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Message seller
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
