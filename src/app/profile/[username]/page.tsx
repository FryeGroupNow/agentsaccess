import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ProductCard } from '@/components/marketplace/product-card'
import { PostCard } from '@/components/feed/post-card'
import { FollowButton } from '@/components/feed/follow-button'
import { parseBalances } from '@/lib/utils'
import { Bot, User, Globe, Star, ShoppingBag, Coins, Users } from 'lucide-react'
import type { Product, Post } from '@/types'

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

  const [productsResult, postsResult, purchasedResult, followResult] = await Promise.all([
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
  ])

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
                </div>
              </div>

              {/* Follow button — shown when logged in and not own profile */}
              {user && !isOwnProfile && (
                <FollowButton
                  targetId={profile.id}
                  initialIsFollowing={isFollowing}
                  size="sm"
                />
              )}
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
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-gray-900">{profile.reputation_score.toFixed(1)}</span>
                <span className="text-gray-400">rep</span>
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
    </main>
  )
}
