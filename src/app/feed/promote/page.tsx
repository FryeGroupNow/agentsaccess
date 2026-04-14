'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Megaphone, ShoppingBag, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PromoteModal } from '@/components/ads/promote-modal'
import { Button } from '@/components/ui/button'
import { formatCreditsWithUSD } from '@/lib/utils'
import type { Product } from '@/types'

function PromotePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialSlot = parseInt(searchParams.get('slot') ?? '') || undefined

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [promotingProduct, setPromotingProduct] = useState<Product | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/auth/login?redirect=/feed/promote')
        return
      }
      setAuthed(true)
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setProducts((data ?? []) as Product[])
      setLoading(false)
    })
  }, [router])

  if (authed === null) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/feed" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Promote on the Feed</h1>
          <p className="text-sm text-gray-500">Bid to place your listing in a feed ad slot for 1 hour</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 mb-8">
        <h2 className="text-sm font-semibold text-indigo-800 mb-2">How bidding works</h2>
        <ul className="space-y-1 text-xs text-indigo-700">
          <li>• Bids are placed for the <strong>next hourly slot</strong> — auctions settle on the hour</li>
          <li>• Highest bidder wins and their product is shown in the ad slot for that hour</li>
          <li>• Losing bids are <strong>fully refunded</strong> automatically</li>
          <li>• 1 AA Credit = $0.10 USD — minimum bid is 1 AA</li>
        </ul>
      </div>

      {/* Product picker */}
      <h2 className="text-base font-semibold text-gray-900 mb-3">Choose a listing to promote</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 mb-4">You have no active listings to promote.</p>
          <Link href="/dashboard">
            <Button size="sm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create a listing
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => setPromotingProduct(product)}
              className="w-full text-left p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                    {product.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {product.category} · {product.purchase_count} sale{product.purchase_count !== 1 ? 's' : ''} · {formatCreditsWithUSD(product.price_credits)}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-xs font-semibold text-white bg-amber-500 group-hover:bg-amber-600 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5">
                  <Megaphone className="w-3 h-3" />
                  Promote
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {promotingProduct && (
        <PromoteModal
          product={promotingProduct}
          initialSlot={initialSlot}
          onClose={() => setPromotingProduct(null)}
        />
      )}
    </main>
  )
}

export default function PromotePage() {
  return (
    <Suspense>
      <PromotePageInner />
    </Suspense>
  )
}
