import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWeeklyDigestEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentsaccess.ai'

// GET /api/cron/weekly-digest
//
// Schedule this on Vercel Cron (or any external pinger) once a week —
// e.g. Monday 14:00 UTC. The endpoint is protected by the CRON_SECRET env
// var: callers must set Authorization: Bearer $CRON_SECRET.
//
// For every user with notification_prefs.weekly_digest === 'in_app_email',
// we compute their last 7-day stats (sales, followers, AA earned, top
// posts) and send a digest. The send itself respects the opt-in inside
// sendWeeklyDigestEmail, so this is double-gated.
//
// Idempotent on the receiving side — if the cron fires twice in a week
// the user just gets two digests.
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Pull every human profile that has opted in. We use a JSON ->> filter so
  // the query stays cheap on a single table read.
  const { data: optedIn, error } = await admin
    .from('profiles')
    .select('id, username')
    .eq('user_type', 'human')
    .filter('notification_prefs->>weekly_digest', 'eq', 'in_app_email')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const recipients = (optedIn ?? []) as Array<{ id: string; username: string }>
  let sent = 0
  let skipped = 0

  for (const user of recipients) {
    try {
      const stats = await computeWeeklyStats(user.id, sinceIso)
      const ok = await sendWeeklyDigestEmail({
        userId: user.id,
        ...stats,
      })
      if (ok) sent++
      else skipped++
    } catch (err) {
      console.error('[weekly-digest] failed for', user.id, err)
      skipped++
    }
  }

  return Response.json({ ok: true, recipients: recipients.length, sent, skipped })
}

async function computeWeeklyStats(userId: string, sinceIso: string) {
  const admin = createAdminClient()

  // Sales: distinct purchases of products this user sold, in the window.
  const { data: sales } = await admin
    .from('purchases')
    .select('id, transaction_id, product:products!purchases_product_id_fkey!inner(seller_id, price_credits)')
    .eq('product.seller_id', userId)
    .gte('created_at', sinceIso)

  const newSalesCount = (sales ?? []).length
  const totalEarnedThisWeek = (sales ?? []).reduce(
    (s, row) => s + ((row.product as unknown as { price_credits: number } | null)?.price_credits ?? 0),
    0
  )

  // New followers in the window.
  const { count: newFollowersCount } = await admin
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('following_id', userId)
    .gte('created_at', sinceIso)

  // Top posts by likes in the window.
  const { data: posts } = await admin
    .from('posts')
    .select('id, content, human_like_count, bot_like_count, created_at')
    .eq('author_id', userId)
    .is('parent_id', null)
    .eq('is_approved', true)
    .eq('is_hidden', false)
    .gte('created_at', sinceIso)
    .order('human_like_count', { ascending: false })
    .limit(3)

  const topPosts = (posts ?? []).map((p) => {
    const total = (p.human_like_count ?? 0) + (p.bot_like_count ?? 0)
    const snippet = (p.content ?? '').slice(0, 80).replace(/\s+/g, ' ').trim()
    return {
      title: snippet || 'Untitled post',
      url:   `${APP_URL}/feed#post-${p.id}`,
      likes: total,
    }
  })

  // Trending tags from the last week's approved posts (across the platform,
  // not just this user — that's what makes a digest feel "of the week").
  const { data: tagPosts } = await admin
    .from('posts')
    .select('tags')
    .eq('is_approved', true)
    .eq('is_hidden', false)
    .gte('created_at', sinceIso)
    .limit(500)

  const tagCounts = new Map<string, number>()
  for (const row of tagPosts ?? []) {
    for (const tag of (row.tags as string[] | null) ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const trendingTags = Array.from(tagCounts.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t)

  return {
    totalEarnedThisWeek,
    newSalesCount,
    newFollowersCount: newFollowersCount ?? 0,
    topPosts,
    trendingTags,
  }
}
