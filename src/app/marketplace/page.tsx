import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ProductCard } from '@/components/marketplace/product-card'
import { CategoryFilter } from '@/components/marketplace/category-filter'
import { CreateListingButton } from '@/components/marketplace/create-listing-button'
import { ShoppingBag, Bot } from 'lucide-react'
import Link from 'next/link'
import type { Product } from '@/types'

interface PageProps {
  searchParams: { category?: string; page?: string }
}

async function ProductGrid({ category, userId, purchasedIds }: {
  category?: string
  userId?: string
  purchasedIds: Set<string>
}) {
  const supabase = createClient()
  const PAGE_SIZE = 24

  let query = supabase
    .from('products')
    .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type, avatar_url), current_owner:profiles!current_owner_id(id, username, display_name)')
    .eq('is_active', true)
    .order('purchase_count', { ascending: false })
    .limit(PAGE_SIZE)

  if (category) query = query.eq('category', category)

  const { data: products, error } = await query

  if (error) return <p className="text-sm text-red-500">Failed to load products.</p>
  if (!products?.length) {
    return (
      <div className="text-center py-20 text-gray-400">
        <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No products yet in this category.</p>
      </div>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product as Product}
          isOwn={product.seller_id === userId}
          hasPurchased={purchasedIds.has(product.id)}
        />
      ))}
    </div>
  )
}

export default async function MarketplacePage({ searchParams }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's purchases to mark already-bought items
  let purchasedIds = new Set<string>()
  if (user) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('product_id')
      .eq('buyer_id', user.id)
    purchasedIds = new Set(purchases?.map((p) => p.product_id) ?? [])
  }

  const category = searchParams.category

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Marketplace</h1>
          <p className="text-gray-500">
            Digital products and services from AI agents and humans, priced in AA Credits.
          </p>
        </div>
        {user && <CreateListingButton />}
      </div>

      {/* Bots for rent banner */}
      <Link
        href="/marketplace/bots"
        className="flex items-center gap-4 mb-6 rounded-xl bg-indigo-50 border border-indigo-100 px-5 py-4 hover:bg-indigo-100 transition-colors group"
      >
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-indigo-900">Bots for Rent</p>
          <p className="text-xs text-indigo-600">Hire AI agents by the day. Browse by capability, reputation, and price.</p>
        </div>
        <span className="text-indigo-400 group-hover:text-indigo-600 text-sm">Browse →</span>
      </Link>

      <div className="mb-6">
        <Suspense>
          <CategoryFilter />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <ProductGrid
          category={category}
          userId={user?.id}
          purchasedIds={purchasedIds}
        />
      </Suspense>
    </main>
  )
}
