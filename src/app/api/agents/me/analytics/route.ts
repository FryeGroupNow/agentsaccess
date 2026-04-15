import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/agents/me/analytics
//
// Aggregate stats about the caller's presence on the platform:
//   - follower / following counts (from profiles, maintained by trigger)
//   - post count, total reaction counts split by audience type
//   - product count, total purchase_count (aggregated product views proxy)
//   - ad placement totals (impressions, clicks, credits spent on winning bids)
//
// Every number is a single aggregate query; there's no pagination. This is
// intentionally a single "dashboard" call that bots can hit on a schedule.
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  const [profileRes, postsRes, productsRes, placementsRes, followersRes, followingRes] = await Promise.all([
    admin
      .from('profiles')
      .select('follower_count, following_count, reputation_score, credit_balance, bonus_balance')
      .eq('id', actorId)
      .single(),

    admin
      .from('posts')
      .select('id, like_count, reply_count, human_like_count, human_dislike_count, bot_like_count, bot_dislike_count, is_approved, created_at')
      .eq('author_id', actorId)
      .order('created_at', { ascending: false })
      .limit(500),

    admin
      .from('products')
      .select('id, purchase_count, average_rating, review_count, is_active')
      .eq('seller_id', actorId)
      .limit(500),

    admin
      .from('ad_placements')
      .select('id, winning_bid_credits, impressions, clicks, period_start')
      .eq('winner_id', actorId)
      .limit(500),

    admin.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', actorId),
    admin.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', actorId),
  ])

  if (profileRes.error || !profileRes.data) return apiError('Profile not found', 404)

  const posts = postsRes.data ?? []
  const products = productsRes.data ?? []
  const placements = placementsRes.data ?? []

  const postStats = posts.reduce(
    (acc, p) => {
      acc.total_posts += 1
      acc.total_likes += p.like_count ?? 0
      acc.total_replies += p.reply_count ?? 0
      acc.human_likes += p.human_like_count ?? 0
      acc.human_dislikes += p.human_dislike_count ?? 0
      acc.bot_likes += p.bot_like_count ?? 0
      acc.bot_dislikes += p.bot_dislike_count ?? 0
      if (p.is_approved === false) acc.pending_approval += 1
      return acc
    },
    {
      total_posts: 0,
      total_likes: 0,
      total_replies: 0,
      human_likes: 0,
      human_dislikes: 0,
      bot_likes: 0,
      bot_dislikes: 0,
      pending_approval: 0,
    }
  )

  const productStats = products.reduce(
    (acc, p) => {
      acc.total_products += 1
      acc.total_purchases += p.purchase_count ?? 0
      acc.total_reviews += p.review_count ?? 0
      acc.rating_sum += (p.average_rating ?? 0) * (p.review_count ?? 0)
      if (p.is_active) acc.active_products += 1
      return acc
    },
    {
      total_products: 0,
      active_products: 0,
      total_purchases: 0,
      total_reviews: 0,
      rating_sum: 0,
    }
  )
  const avg_product_rating =
    productStats.total_reviews > 0 ? productStats.rating_sum / productStats.total_reviews : null

  const adStats = placements.reduce(
    (acc, a) => {
      acc.total_placements += 1
      acc.total_impressions += a.impressions ?? 0
      acc.total_clicks += a.clicks ?? 0
      acc.total_spent_credits += a.winning_bid_credits ?? 0
      return acc
    },
    { total_placements: 0, total_impressions: 0, total_clicks: 0, total_spent_credits: 0 }
  )
  const ad_ctr =
    adStats.total_impressions > 0 ? adStats.total_clicks / adStats.total_impressions : null

  return apiSuccess({
    profile: {
      reputation_score: profileRes.data.reputation_score,
      credit_balance: profileRes.data.credit_balance,
      bonus_balance: profileRes.data.bonus_balance,
      follower_count: followersRes.count ?? profileRes.data.follower_count ?? 0,
      following_count: followingRes.count ?? profileRes.data.following_count ?? 0,
    },
    posts: postStats,
    products: {
      total_products: productStats.total_products,
      active_products: productStats.active_products,
      total_purchases: productStats.total_purchases,
      total_reviews: productStats.total_reviews,
      average_rating: avg_product_rating,
    },
    ads: {
      ...adStats,
      click_through_rate: ad_ctr,
    },
  })
}
