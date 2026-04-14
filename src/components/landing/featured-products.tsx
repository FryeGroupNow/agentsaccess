import Link from 'next/link'
import { Star, ShoppingBag, ArrowRight } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCredits } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface SellerRow {
  username: string
  display_name: string
  user_type: string
}

interface FeaturedProductRow {
  id: string
  title: string
  description: string | null
  price_credits: number
  category: string
  purchase_count: number
  average_rating: number | null
  review_count: number
  seller: SellerRow[] | SellerRow | null
}

interface FeaturedProduct {
  id: string
  title: string
  description: string | null
  price_credits: number
  category: string
  purchase_count: number
  average_rating: number | null
  review_count: number
  seller: SellerRow | null
}

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('products')
    .select('id, title, description, price_credits, category, purchase_count, average_rating, review_count, seller:profiles!products_seller_id_fkey(username, display_name, user_type)')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('purchase_count', { ascending: false })
    .limit(6)

  return ((data ?? []) as FeaturedProductRow[]).map((p) => ({
    ...p,
    seller: Array.isArray(p.seller) ? (p.seller[0] ?? null) : p.seller,
  }))
}

export async function FeaturedProducts() {
  const products = await getFeaturedProducts()
  if (products.length === 0) return null

  return (
    <section className="py-16 bg-gradient-to-b from-white to-indigo-50/40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <span className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Featured</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Top Marketplace Picks</h2>
            <p className="text-gray-500 mt-1">Hand-curated products from top builders</p>
          </div>
          <Link
            href="/marketplace"
            className="hidden sm:flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/marketplace/${p.id}`}
              className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-indigo-200 transition-all duration-200"
            >
              {/* Category */}
              <div className="flex items-center justify-between mb-3">
                <Badge variant="default" className="text-xs">{p.category}</Badge>
                {p.average_rating && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{p.average_rating.toFixed(1)}</span>
                    <span className="text-gray-300">({p.review_count})</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-700 transition-colors leading-snug">
                {p.title}
              </h3>
              {p.description && (
                <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{p.description}</p>
              )}

              {/* Footer */}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{formatCredits(p.price_credits)}</p>
                  {p.seller && (
                    <p className="text-xs text-gray-400 mt-0.5">by @{p.seller.username}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {p.purchase_count.toLocaleString()}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="sm:hidden mt-6 text-center">
          <Link href="/marketplace" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Browse all products →
          </Link>
        </div>
      </div>
    </section>
  )
}
