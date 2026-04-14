import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ProductBuyBox } from '@/components/marketplace/product-buy-box'
import { HireServiceButton } from '@/components/marketplace/hire-service-button'
import { ReviewSection } from '@/components/marketplace/review-section'
import { DisputeButton } from '@/components/marketplace/dispute-button'
import { ReportButton } from '@/components/shared/report-button'
import { ProductCard } from '@/components/marketplace/product-card'
import { MessageButton } from '@/components/profile/message-button'
import { FollowButton } from '@/components/feed/follow-button'
import { ReputationBadge } from '@/components/ui/reputation-badge'
import { formatCredits, creditsToUSD } from '@/lib/utils'
import {
  ArrowLeft, Bot, User, Download, Calendar,
  ShoppingBag, Star, Tag, Image as ImageIcon,
} from 'lucide-react'
import { PRODUCT_TYPE_LABELS, type Product, type ProductType, type ProductSections } from '@/types'

interface PageProps {
  params: { id: string }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

const SECTION_ORDER: { key: keyof ProductSections; label: string }[] = [
  { key: 'whats_included', label: "What's included" },
  { key: 'who_its_for',    label: 'Who this is for' },
  { key: 'how_it_works',   label: 'How it works' },
  { key: 'requirements',   label: 'Requirements' },
  { key: 'faq',            label: 'FAQ' },
]

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

  let hasPurchased = false
  let isFollowing = false
  if (user && !isOwn) {
    const [{ data: purchase }, { data: follow }] = await Promise.all([
      supabase.from('purchases').select('id').eq('buyer_id', user.id).eq('product_id', params.id).maybeSingle(),
      supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', product.seller_id).maybeSingle(),
    ])
    hasPurchased = !!purchase
    isFollowing = !!follow
  }

  const p = product as unknown as Product & {
    seller: {
      id: string; username: string; display_name: string
      reputation_score: number; user_type: string
      avatar_url: string | null; bio: string | null; follower_count: number
    } | null
  }

  // Fetch related: more from this seller + similar products (same category, different id)
  const [{ data: moreFromSeller }, { data: similar }] = await Promise.all([
    supabase
      .from('products')
      .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type, avatar_url)')
      .eq('seller_id', p.seller_id)
      .eq('is_active', true)
      .neq('id', params.id)
      .order('purchase_count', { ascending: false })
      .limit(4),
    supabase
      .from('products')
      .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type, avatar_url)')
      .eq('category', p.category)
      .eq('is_active', true)
      .neq('id', params.id)
      .neq('seller_id', p.seller_id)
      .order('purchase_count', { ascending: false })
      .limit(4),
  ])

  const usdPrice = creditsToUSD(p.price_credits)
  const fileExt = p.file_name ? p.file_name.split('.').pop()?.toUpperCase() ?? 'FILE' : null
  const productType = (p.product_type ?? 'digital_product') as ProductType
  const isService = productType === 'service'
  const pricingType = p.pricing_type ?? 'one_time'
  const sections: ProductSections = (p.sections ?? {}) as ProductSections

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      {/* Hero cover */}
      {p.cover_image_url && (
        <div className="mb-8 rounded-2xl overflow-hidden border border-gray-100 bg-gradient-to-br from-gray-50 to-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.cover_image_url} alt={p.title} className="w-full max-h-[480px] object-cover" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-10">
        {/* Left: content */}
        <div className="lg:col-span-2 space-y-10">

          {/* Title block */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="default" className="text-xs">
                {PRODUCT_TYPE_LABELS[productType]}
              </Badge>
              <Badge variant="default" className="text-xs">{p.category}</Badge>
              {p.is_featured && (
                <Badge variant="default" className="text-xs bg-amber-50 text-amber-700 border-amber-100">
                  <Star className="w-3 h-3 mr-0.5 fill-amber-400 text-amber-400" />
                  Featured
                </Badge>
              )}
              {!p.is_active && (
                <Badge variant="default" className="text-xs bg-gray-100 text-gray-500">Inactive</Badge>
              )}
            </div>
            <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-2">{p.title}</h1>
            {p.tagline && (
              <p className="text-lg text-gray-500 leading-snug">{p.tagline}</p>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-5 mt-4 text-sm text-gray-500">
              {p.review_count > 0 && p.average_rating != null && (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <strong className="text-gray-800">{p.average_rating.toFixed(1)}</strong>
                  <span className="text-gray-400">({p.review_count} review{p.review_count !== 1 ? 's' : ''})</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" />
                {p.purchase_count.toLocaleString()} {isService ? 'hired' : 'sold'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Listed {formatDate(p.created_at)}
              </span>
            </div>
          </div>

          {/* Seller card */}
          {p.seller && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <Link href={`/profile/${p.seller.username}`}>
                  <Avatar name={p.seller.display_name} src={p.seller.avatar_url} size="lg" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/profile/${p.seller.username}`} className="font-semibold text-gray-900 hover:text-indigo-700">
                      {p.seller.display_name}
                    </Link>
                    <Badge variant={p.seller.user_type === 'agent' ? 'agent' : 'human'} className="text-xs">
                      {p.seller.user_type === 'agent'
                        ? <><Bot className="w-3 h-3 mr-0.5" />agent</>
                        : <><User className="w-3 h-3 mr-0.5" />human</>}
                    </Badge>
                    <ReputationBadge score={p.seller.reputation_score} size="sm" />
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    @{p.seller.username} · {p.seller.follower_count.toLocaleString()} followers
                  </p>
                  {p.seller.bio && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.seller.bio}</p>
                  )}
                </div>
                {!isOwn && user && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <FollowButton targetId={p.seller.id} initialIsFollowing={isFollowing} size="sm" />
                    <MessageButton toId={p.seller.id} size="sm" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">About this listing</h2>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {p.description}
            </div>
          </div>

          {/* Gallery */}
          {p.images && p.images.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-500" />
                Gallery
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {p.images.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`${p.title} screenshot ${i + 1}`}
                    className="w-full aspect-video object-cover rounded-xl border border-gray-100"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          {SECTION_ORDER.map(({ key, label }) => {
            const value = sections[key]
            if (!value || !value.trim()) return null
            return (
              <div key={key}>
                <h2 className="text-xl font-bold text-gray-900 mb-3">{label}</h2>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {value}
                </div>
              </div>
            )
          })}

          {/* File info */}
          {p.file_name && !isService && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-500" />
                Included file
              </h2>
              <div className="flex items-center gap-4 text-sm">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
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
                  <span key={tag} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <ReviewSection
            productId={params.id}
            hasPurchased={hasPurchased}
            sellerId={p.seller_id}
            currentUserId={user?.id ?? null}
          />
        </div>

        {/* Right: sticky buy/hire box */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-gray-200 p-6 shadow-sm bg-white">
              <div className="mb-5">
                {pricingType === 'contact' ? (
                  <div className="text-2xl font-bold text-gray-900">Contact for pricing</div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-gray-900">{formatCredits(p.price_credits)}</div>
                    <div className="text-sm text-gray-400 mt-1">
                      ≈ ${usdPrice.toFixed(2)} USD
                      {pricingType === 'subscription' && p.subscription_period_days && (
                        <> · per {p.subscription_period_days}-day period</>
                      )}
                    </div>
                  </>
                )}
              </div>

              {p.is_digital_art && p.current_owner && !isOwn && (
                <p className="text-xs text-gray-400 mb-4">
                  Currently owned by{' '}
                  <Link href={`/profile/${(p.current_owner as { username: string }).username}`} className="text-indigo-500 hover:underline">
                    @{(p.current_owner as { username: string }).username}
                  </Link>
                </p>
              )}

              {isService ? (
                <HireServiceButton
                  productId={params.id}
                  productTitle={p.title}
                  priceCredits={p.price_credits}
                  isLoggedIn={!!user}
                  isOwn={isOwn}
                />
              ) : pricingType === 'contact' ? (
                user && !isOwn && p.seller ? (
                  <MessageButton toId={p.seller.id} variant="primary" size="md" />
                ) : (
                  <p className="text-xs text-center text-gray-400">Sign in to contact the seller.</p>
                )
              ) : (
                <ProductBuyBox
                  product={p}
                  isOwn={isOwn}
                  hasPurchased={hasPurchased}
                  isLoggedIn={!!user}
                />
              )}

              {!isOwn && !hasPurchased && p.is_active && pricingType === 'one_time' && !isService && (
                <p className="text-xs text-gray-400 text-center mt-3">
                  2.5% buyer fee applies at checkout
                </p>
              )}

              {/* Dispute + report */}
              {hasPurchased && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <DisputeButton productId={params.id} productTitle={p.title} />
                  <ReportButton targetType="product" targetId={params.id} label />
                </div>
              )}
              {!hasPurchased && !isOwn && (
                <div className="mt-3 flex justify-end">
                  <ReportButton targetType="product" targetId={params.id} label />
                </div>
              )}
            </div>

            {/* Quick facts */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 text-xs text-gray-500 space-y-2">
              <div className="flex items-center justify-between">
                <span>Type</span>
                <span className="font-semibold text-gray-700">{PRODUCT_TYPE_LABELS[productType]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Category</span>
                <span className="font-semibold text-gray-700">{p.category}</span>
              </div>
              {p.review_count > 0 && p.average_rating != null && (
                <div className="flex items-center justify-between">
                  <span>Rating</span>
                  <span className="font-semibold text-gray-700 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {p.average_rating.toFixed(1)} ({p.review_count})
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>{isService ? 'Hired' : 'Sold'}</span>
                <span className="font-semibold text-gray-700">{p.purchase_count.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Starter AA</span>
                <span className={`font-semibold ${p.accept_starter_aa !== false ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {p.accept_starter_aa !== false ? 'Accepted' : 'Not accepted'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* More from this seller */}
      {moreFromSeller && moreFromSeller.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-5">
            More from {p.seller?.display_name ?? 'this seller'}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {moreFromSeller.map((item) => (
              <ProductCard key={item.id} product={item as Product} />
            ))}
          </div>
        </section>
      )}

      {/* Similar products */}
      {similar && similar.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-5">Similar listings</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {similar.map((item) => (
              <ProductCard key={item.id} product={item as Product} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
