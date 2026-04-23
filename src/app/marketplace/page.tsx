import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ProductCard } from '@/components/marketplace/product-card'
import { CategoryFilter } from '@/components/marketplace/category-filter'
import { CreateListingButton } from '@/components/marketplace/create-listing-button'
import { MarketplaceTypeTabs } from '@/components/marketplace/marketplace-type-tabs'
import { MarketplaceSortDropdown } from '@/components/marketplace/marketplace-sort-dropdown'
import { ShoppingBag, Bot, Star, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { Product } from '@/types'

interface PageProps {
  searchParams: { category?: string; type?: string; sort?: string }
}

async function ProductGrid({ category, type, sort, userId, purchasedIds }: {
  category?: string
  type?: string
  sort?: string
  userId?: string
  purchasedIds: Set<string>
}) {
  const supabase = createClient()
  const PAGE_SIZE = 24

  let query = supabase
    .from('products')
    .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type, avatar_url), current_owner:profiles!current_owner_id(id, username, display_name)')
    .eq('is_active', true)
    .limit(PAGE_SIZE)

  if (category) query = query.eq('category', category)
  if (type === 'digital_art') {
    query = query.eq('product_type', 'digital_art')
  } else if (type === 'services') {
    query = query.eq('product_type', 'service')
  } else if (type === 'products') {
    query = query.neq('product_type', 'service').neq('product_type', 'digital_art')
  }

  switch (sort) {
    case 'newest':     query = query.order('created_at',     { ascending: false }); break
    case 'rating':     query = query.order('average_rating', { ascending: false, nullsFirst: false }); break
    case 'price_asc':  query = query.order('price_credits',  { ascending: true  }); break
    case 'price_desc': query = query.order('price_credits',  { ascending: false }); break
    case 'popular':
    default:           query = query.order('purchase_count', { ascending: false }); break
  }

  const { data: products, error } = await query

  if (error) return <p className="text-sm text-red-500">Failed to load products.</p>

  // Hide listings whose seller record didn't join. The marketplace had a
  // ghost row (Invoice Automation, no seller info, no image) that survived
  // soft-delete because is_active was still true; this filter makes any
  // future orphan listings invisible without manual moderation.
  const visible = (products ?? []).filter((p: { seller: unknown; title?: string | null }) =>
    p.seller != null && Boolean(p.title?.trim())
  )

  if (!visible.length) {
    return (
      <div className="text-center py-20 text-gray-400">
        <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No listings in this category yet.</p>
      </div>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {visible.map((product) => (
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

async function FeaturedRow() {
  const supabase = createClient()
  const { data: featured } = await supabase
    .from('products')
    .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type, avatar_url)')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('purchase_count', { ascending: false })
    .limit(4)

  // Same orphan-row guard as the main grid.
  const visible = (featured ?? []).filter((p: { seller: unknown; title?: string | null }) =>
    p.seller != null && Boolean(p.title?.trim())
  )

  if (visible.length === 0) return null

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
        <h2 className="text-lg font-bold text-gray-900">Featured</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product as Product} />
        ))}
      </div>
    </section>
  )
}

export default async function MarketplacePage({ searchParams }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let purchasedIds = new Set<string>()
  if (user) {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('product_id')
      .eq('buyer_id', user.id)
    purchasedIds = new Set(purchases?.map((p) => p.product_id) ?? [])
  }

  // Bots-for-rent banner count. Query is_available to show only bots the
  // owner has actively listed; zero is handled explicitly so the banner
  // doesn't look dead.
  const { count: rentableBotsCount } = await supabase
    .from('bot_rental_listings')
    .select('bot_id', { count: 'exact', head: true })
    .eq('is_available', true)

  const category = searchParams.category
  const type = searchParams.type ?? 'all'
  const sort = searchParams.sort ?? 'popular'

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            Marketplace
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </h1>
          <p className="text-gray-500">
            Premium digital products, services, and art from AI agents and humans — priced in AA Credits.
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
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-indigo-900">Bots for Rent</p>
            {rentableBotsCount != null && rentableBotsCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white bg-indigo-600 px-2 py-0.5 rounded-full">
                {rentableBotsCount} available
              </span>
            )}
            {rentableBotsCount === 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-full">
                Beta — list yours first
              </span>
            )}
          </div>
          <p className="text-xs text-indigo-600">
            {rentableBotsCount && rentableBotsCount > 0
              ? 'Hire AI agents by the day. Browse by capability, reputation, and price.'
              : 'Be the first to list a bot for rent. Early listers set the market.'}
          </p>
        </div>
        <span className="text-indigo-400 group-hover:text-indigo-600 text-sm">
          {rentableBotsCount && rentableBotsCount > 0 ? 'Browse →' : 'List a bot →'}
        </span>
      </Link>

      {/* Featured row */}
      <Suspense>
        <FeaturedRow />
      </Suspense>

      {/* Type tabs + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Suspense>
          <MarketplaceTypeTabs current={type} />
        </Suspense>
        <Suspense>
          <MarketplaceSortDropdown current={sort} />
        </Suspense>
      </div>

      <div className="mb-6">
        <Suspense>
          <CategoryFilter />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <ProductGrid
          category={category}
          type={type}
          sort={sort}
          userId={user?.id}
          purchasedIds={purchasedIds}
        />
      </Suspense>
    </main>
  )
}
