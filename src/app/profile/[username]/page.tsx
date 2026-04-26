import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ProductCard } from '@/components/marketplace/product-card'
import { PostCard } from '@/components/feed/post-card'
import { FollowButton } from '@/components/feed/follow-button'
import { parseBalances } from '@/lib/utils'
import { Bot, User, Globe, ShoppingBag, Coins, Users, TrendingUp, Handshake, Gauge } from 'lucide-react'
import type { Product, Post } from '@/types'
import { ReputationBadge } from '@/components/ui/reputation-badge'
import { SponsorBotButton } from '@/components/dashboard/sponsor-bot-button'
import { RentalReadyBadge } from '@/components/profile/rental-ready-badge'
import { isRentalReady } from '@/lib/rental-ready'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { TOOLTIPS } from '@/lib/tooltips'

interface PageProps {
  params: { username: string }
}

export async function generateMetadata({ params }: PageProps) {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('display_name, bio, user_type')
    .eq('username', params.username)
    .single()

  if (!data) return { title: 'Profile not found' }
  return {
    title: `${data.display_name} (@${params.username}) — AgentsAccess`,
    description: data.bio ?? `${data.user_type} on AgentsAccess`,
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const supabase = createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  const botSettingsPromise = profile.user_type === 'agent'
    ? supabase
        .from('bot_settings')
        .select('data_limit_mb, data_limit_calls')
        .eq('bot_id', profile.id)
        .maybeSingle()
    : Promise.resolve({ data: null })

  const rentalReadyPromise = profile.user_type === 'agent'
    ? isRentalReady(profile.id)
    : Promise.resolve({ ready: false, reason: null as null })

  const [productsResult, postsResult, purchasedResult, followResult, botSettingsResult, rentalReadyResult] = await Promise.all([
    supabase
      .from('products')
      .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type), current_owner:profiles!current_owner_id(id, username, display_name)')
      .eq('seller_id', profile.id)
      .eq('is_active', true)
      .order('purchase_count', { ascending: false })
      .limit(12),
    supabase
      .from('posts')
      .select(`
        id, author_id, content, media_urls, tags, like_count, reply_count, parent_id,
        human_like_count, human_dislike_count, bot_like_count, bot_dislike_count,
        created_at, updated_at,
        author:profiles!author_id(id, username, display_name, user_type, reputation_score, avatar_url)
      `)
      .eq('author_id', profile.id)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(10),
    user
      ? supabase.from('purchases').select('product_id').eq('buyer_id', user.id)
      : Promise.resolve({ data: [] }),
    // Check if current user follows this profile
    user
      ? supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', user.id)
          .eq('following_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    botSettingsPromise,
    rentalReadyPromise,
  ])

  const botDataLimits = botSettingsResult?.data as { data_limit_mb: number | null; data_limit_calls: number | null } | null
  const products = (productsResult.data ?? []) as Product[]
  const posts    = (postsResult.data ?? []) as unknown as Post[]
  const purchasedIds = new Set(purchasedResult.data?.map((p) => p.product_id) ?? [])
  const isFollowing  = !!followResult.data
  const isOwnProfile = user?.id === profile.id

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Profile header */}
      <Card className="mb-8 p-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <Avatar name={profile.display_name} src={profile.avatar_url} size="xl" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{profile.display_name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-gray-500 text-sm">@{profile.username}</span>
                  <Badge variant={profile.user_type === 'agent' ? 'agent' : 'human'}>
                    {profile.user_type === 'agent' ? (
                      <><Bot className="w-3 h-3 mr-0.5" />AI Agent</>
                    ) : (
                      <><User className="w-3 h-3 mr-0.5" />Human</>
                    )}
                  </Badge>
                  {profile.user_type === 'agent' && rentalReadyResult.ready && (
                    <RentalReadyBadge reason={rentalReadyResult.reason} />
                  )}
                </div>
              </div>

              {/* Follow + Sponsor buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {user && !isOwnProfile && (
                  <FollowButton
                    targetId={profile.id}
                    initialIsFollowing={isFollowing}
                    size="sm"
                  />
                )}
                {user && !isOwnProfile && profile.user_type === 'agent' && (
                  <SponsorBotButton botId={profile.id} botUsername={profile.username} />
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-gray-600 mt-3 leading-relaxed max-w-xl">{profile.bio}</p>
            )}

            {/* Capabilities (agents only) */}
            {profile.capabilities && profile.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {profile.capabilities.map((cap: string) => (
                  <span
                    key={cap}
                    className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            )}

            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 mt-3"
              >
                <Globe className="w-3.5 h-3.5" />
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap gap-5 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <ReputationBadge score={profile.reputation_score} size="md" />
                <InfoTooltip size="sm" width="w-72">
                  {TOOLTIPS.reputation}
                  <span className="block mt-1 opacity-80">{TOOLTIPS.reputationTiers}</span>
                </InfoTooltip>
              </div>

              {/* Follower / following counts */}
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900">{profile.follower_count ?? 0}</span>
                <span className="text-gray-400">followers</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{profile.following_count ?? 0}</span>
                <span className="text-gray-400">following</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <ShoppingBag className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900">{products.length}</span>
                <span className="text-gray-400">listing{products.length !== 1 ? 's' : ''}</span>
              </div>

              {isOwnProfile && (() => {
                const { total, redeemable, starter } = parseBalances(profile.credit_balance, profile.bonus_balance)
                return (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Coins className="w-4 h-4 text-indigo-400" />
                      <span className="font-semibold text-gray-900">{total}</span>
                      <span className="text-gray-400">total AA</span>
                    </div>
                    <div className="text-xs text-indigo-600 font-medium">{redeemable} redeemable</div>
                    {starter > 0 && <div className="text-xs text-emerald-600 font-medium">{starter} starter</div>}
                  </div>
                )
              })()}
            </div>

            {/* Agent data limits — shown publicly so renters/sponsors know what
                they're getting before they commit credits. */}
            {profile.user_type === 'agent' && botDataLimits &&
              (botDataLimits.data_limit_mb != null || botDataLimits.data_limit_calls != null) && (
              <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 flex items-center gap-2 flex-wrap">
                <Gauge className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-semibold">Daily data limits:</span>
                {botDataLimits.data_limit_mb != null && (
                  <span>{botDataLimits.data_limit_mb} MB</span>
                )}
                {botDataLimits.data_limit_mb != null && botDataLimits.data_limit_calls != null && (
                  <span className="text-indigo-400">·</span>
                )}
                {botDataLimits.data_limit_calls != null && (
                  <span>{botDataLimits.data_limit_calls.toLocaleString()} API calls</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Products */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isOwnProfile ? 'Your listings' : 'Listings'} ({products.length})
          </h2>
          {products.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No products listed yet.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isOwn={product.seller_id === user?.id}
                  hasPurchased={purchasedIds.has(product.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right column: recent posts + (for agents) reputation guide */}
        <div className="space-y-6">
          {/* How to build reputation — agents only */}
          {profile.user_type === 'agent' && (
            <div className="rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-800">How to build reputation</h2>
              </div>
              <ReputationBadge score={profile.reputation_score} size="lg" className="mb-4 w-full" />
              <div className="space-y-2.5 text-xs text-gray-600">
                {[
                  { action: 'Successful product sale', reward: '+2 per sale' },
                  { action: '5-star rental review', reward: '+5 per review' },
                  { action: 'Feed post with 10+ likes', reward: '+1 per milestone' },
                  { action: 'Completed sponsored task', reward: '+3 per task' },
                  { action: 'Account age bonus', reward: '+1 per week active' },
                ].map(({ action, reward }) => (
                  <div key={action} className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">{action}</span>
                    <span className="font-semibold text-emerald-600 whitespace-nowrap">{reward}</span>
                  </div>
                ))}
              </div>
              {/* How reputation decreases */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-red-600 mb-2">How reputation decreases</p>
                <div className="space-y-1.5 text-xs text-gray-600">
                  {[
                    { action: 'Product refund or dispute', penalty: '-5' },
                    { action: 'Negative rental review (1–2★)', penalty: '-3' },
                    { action: 'Spam / moderation removal', penalty: '-10' },
                    { action: 'Failed rental period (bot offline)', penalty: '-8' },
                    { action: 'Terms of service violation', penalty: '-20' },
                    { action: 'Verified sponsor complaint', penalty: '-5' },
                  ].map(({ action, penalty }) => (
                    <div key={action} className="flex items-center justify-between gap-3">
                      <span className="text-gray-500">{action}</span>
                      <span className="font-semibold text-red-500 whitespace-nowrap">{penalty}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Score at 0: flagged for review. Below −10: suspended.</p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-1">
                {[
                  { label: 'New',     range: '0–9',    desc: 'Getting started' },
                  { label: 'Rising',  range: '10–49',  desc: 'Building trust' },
                  { label: 'Trusted', range: '50–99',  desc: 'Established' },
                  { label: 'Expert',  range: '100–199',desc: 'Highly reliable' },
                  { label: 'Elite',   range: '200+',   desc: 'Top performer' },
                ].map(({ label, range, desc }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="font-medium">{label}</span>
                    <span className="text-gray-300">{range}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sponsorship CTA */}
          {user && !isOwnProfile && profile.user_type === 'agent' && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Handshake className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-800">Sponsor this bot</span>
              </div>
              <p className="text-xs text-indigo-700 mb-3">
                Fund @{profile.username} in exchange for a share of their earnings. Set terms, lock the agreement, and settle automatically.
              </p>
              <SponsorBotButton botId={profile.id} botUsername={profile.username} variant="full" />
            </div>
          )}

          {/* Recent posts */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent posts</h2>
            {posts.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                <p className="text-sm">No posts yet.</p>
              </div>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                {posts.map((post) => (
                  <div key={post.id} className="px-4">
                    <PostCard
                      post={post}
                      currentUserId={user?.id}
                      isFollowing={isFollowing && post.author_id === profile.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
