import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ProductBuyBox } from '@/components/marketplace/product-buy-box'
import { formatCredits, creditsToUSD } from '@/lib/utils'
import {
  ArrowLeft, Bot, User, Download, Palette, Calendar,
  ShoppingBag, Star, Tag,
} from 'lucide-react'
import type { Product } from '@/types'

interface PageProps {
  params: { id: string }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function ProductDetailPage({ params }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      seller:profiles!seller_id(id, username, display_name, reputation_score, user_type, avatar_url, bio, follower_count),
      current_owner:profiles!current_owner_id(id, username, display_name)
    `)
    .eq('id', params.id)
    .single()

  if (error || !product) notFound()

  const isOwn = user?.id === product.seller_id

  // Check if user already purchased
  let hasPurchased = false
  if (user && !isOwn) {
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('product_id', params.id)
      .maybeSingle()
    hasPurchased = !!purchase
  }

  const p = product as Product & {
    seller: {
      id: string; username: string; display_name: string
      reputation_score: number; user_type: string
      avatar_url: string | null; bio: string | null; follower_count: number
    } | null
  }

  const usdPrice = creditsToUSD(p.price_credits)

  const fileExt = p.file_name
    ? p.file_name.split('.').pop()?.toUpperCase() ?? 'FILE'
    : null

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* Left: product details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Title + badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="default">{p.category}</Badge>
              {p.is_digital_art && (
                <Badge variant="agent">
                  <Palette className="w-3 h-3 mr-1" />Digital Art
                </Badge>
              )}
              {!p.is_active && (
                <Badge variant="default" className="bg-gray-100 text-gray-500">Inactive</Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">{p.title}</h1>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" />
                {p.purchase_count.toLocaleString()} sale{p.purchase_count !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Listed {formatDate(p.created_at)}
              </span>
              {p.accept_starter_aa !== false ? (
                <span className="text-emerald-600 font-medium">✓ Accepts Starter AA</span>
              ) : (
                <span className="text-amber-600">Redeemable AA only</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Description</h2>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {p.description}
            </div>
          </div>

          {/* File info */}
          {p.file_name && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-500" />
                Included file
              </h2>
              <div className="flex items-center gap-4 text-sm">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-600">{fileExt}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">{p.file_name}</p>
                  {p.file_size_bytes && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatBytes(p.file_size_bytes)}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Download link delivered immediately after purchase.
              </p>
            </div>
          )}

          {/* Tags */}
          {p.tags.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-gray-400" />
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Seller profile */}
          {p.seller && (
            <div className="rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Seller</h2>
              <Link href={`/profile/${p.seller.username}`} className="flex items-start gap-3 hover:opacity-80 transition-opacity">
                <Avatar name={p.seller.display_name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{p.seller.display_name}</span>
                    <Badge variant={p.seller.user_type === 'agent' ? 'agent' : 'human'} className="text-xs">
                      {p.seller.user_type === 'agent'
                        ? <><Bot className="w-3 h-3 mr-0.5" />agent</>
                        : <><User className="w-3 h-3 mr-0.5" />human</>}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">@{p.seller.username}</p>
                  {p.seller.bio && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.seller.bio}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      {p.seller.reputation_score.toFixed(0)} reputation
                    </span>
                    <span>{p.seller.follower_count.toLocaleString()} followers</span>
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Right: buy box (sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <div className="rounded-xl border border-gray-200 p-6 shadow-sm bg-white">
              {/* Price */}
              <div className="mb-5">
                <div className="text-3xl font-bold text-gray-900">
                  {formatCredits(p.price_credits)}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  ≈ ${usdPrice.toFixed(2)} USD
                </div>
              </div>

              {/* Digital art ownership */}
              {p.is_digital_art && p.current_owner && !isOwn && (
                <p className="text-xs text-gray-400 mb-4">
                  Currently owned by{' '}
                  <Link href={`/profile/${(p.current_owner as { username: string }).username}`} className="text-indigo-500 hover:underline">
                    @{(p.current_owner as { username: string }).username}
                  </Link>
                </p>
              )}

              <ProductBuyBox
                product={p as Product}
                isOwn={isOwn}
                hasPurchased={hasPurchased}
                isLoggedIn={!!user}
              />

              {/* Fee note */}
              {!isOwn && !hasPurchased && p.is_active && (
                <p className="text-xs text-gray-400 text-center mt-3">
                  2.5% buyer fee applies at checkout
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
