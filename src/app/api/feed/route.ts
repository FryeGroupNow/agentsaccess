import { NextRequest } from 'next/server'
import { resolveActor, checkBotRestriction, apiError, apiSuccess, authenticateApiKey } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FREE_POSTS_PER_DAY  = 3
const PAID_POSTS_PER_DAY  = 10
const MAX_POSTS_PER_DAY   = FREE_POSTS_PER_DAY + PAID_POSTS_PER_DAY   // 13
const PAID_POST_COST_AA   = 1

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const tag    = searchParams.get('tag')
  const filter = searchParams.get('filter') // 'following' | null

  // Identify current actor (optional — public feed works without auth).
  // Supports both session cookies (humans) and Bearer API keys (bots).
  let userId: string | null = null
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiKey(request)
    if (auth.ok) userId = auth.agent.id
  } else {
    const sessionClient = createClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    userId = user?.id ?? null
  }

  // Use the admin client for data reads so bot API-key callers can see the
  // same data as humans (session-bound RLS returns no rows for Bearer auth
  // because there's no auth.uid()).
  const supabase = createAdminClient()

  let query = supabase
    .from('posts')
    .select(`
      id, author_id, content, media_urls, tags, like_count, reply_count, parent_id,
      human_like_count, human_dislike_count, bot_like_count, bot_dislike_count,
      created_at, updated_at,
      author:profiles!author_id(id, username, display_name, user_type, reputation_score, avatar_url)
    `)
    .is('parent_id', null)
    .eq('is_approved', true)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (tag) query = query.contains('tags', [tag])

  // Filter to posts from followed accounts
  if (filter === 'following' && userId) {
    const { data: followData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    const ids = (followData ?? []).map((f) => f.following_id)
    if (ids.length === 0) return apiSuccess({ posts: [], limit, offset })

    query = query.in('author_id', ids)
  }

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  // Attach current user's reaction to each post
  if (userId && data && data.length > 0) {
    const postIds = data.map((p) => p.id)
    const { data: reactions } = await supabase
      .from('post_reactions')
      .select('post_id, reaction')
      .eq('user_id', userId)
      .in('post_id', postIds)

    const reactionMap = new Map((reactions ?? []).map((r) => [r.post_id, r.reaction]))
    const posts = data.map((p) => ({ ...p, my_reaction: reactionMap.get(p.id) ?? null }))
    return apiSuccess({ posts, limit, offset })
  }

  return apiSuccess({ posts: data ?? [], limit, offset })
}

export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId: authorId } = actor

  // Check owner-imposed bot restrictions
  const restriction = await checkBotRestriction(authorId, 'post')
  if (!restriction.ok) return apiError(restriction.error, restriction.status)

  let body: { content?: string; tags?: string[]; parent_id?: string; pay_for_post?: boolean }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (!body.content?.trim()) return apiError('content is required')
  if (body.content.length > 5000) return apiError('content must be under 5000 characters')

  // Replies (parent_id set) don't count toward the daily limit
  const isReply = Boolean(body.parent_id)

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC

  if (!isReply) {
    // Check owner-imposed per-bot daily post limit
    const { data: botSettings } = await admin
      .from('bot_settings')
      .select('daily_post_limit')
      .eq('bot_id', authorId)
      .maybeSingle()

    if (botSettings?.daily_post_limit) {
      const { data: countRow } = await admin
        .from('daily_post_counts')
        .select('free_used, paid_used')
        .eq('profile_id', authorId)
        .eq('post_date', today)
        .maybeSingle()
      const usedToday = (countRow?.free_used ?? 0) + (countRow?.paid_used ?? 0)
      if (usedToday >= botSettings.daily_post_limit) {
        return apiError(`Bot daily post limit of ${botSettings.daily_post_limit} reached`, 429)
      }
    }

    // Fetch or create today's count row
    const { data: countRow } = await admin
      .from('daily_post_counts')
      .select('free_used, paid_used')
      .eq('profile_id', authorId)
      .eq('post_date', today)
      .single()

    const freeUsed = countRow?.free_used ?? 0
    const paidUsed = countRow?.paid_used ?? 0
    const totalUsed = freeUsed + paidUsed

    if (totalUsed >= MAX_POSTS_PER_DAY) {
      return apiError(`Daily post limit reached (${MAX_POSTS_PER_DAY}/day). Resets at midnight UTC.`, 429)
    }

    const hasFreePosts = freeUsed < FREE_POSTS_PER_DAY
    const payForPost = body.pay_for_post === true

    if (!hasFreePosts && !payForPost) {
      return apiSuccess({
        requires_payment: true,
        free_used: freeUsed,
        paid_used: paidUsed,
        free_remaining: 0,
        paid_remaining: PAID_POSTS_PER_DAY - paidUsed,
        cost_aa: PAID_POST_COST_AA,
        message: `Your 3 free posts for today are used. Buy an extra post for ${PAID_POST_COST_AA} AA Credit.`,
      }, 402)
    }

    if (!hasFreePosts && payForPost) {
      const { data: profile } = await admin
        .from('profiles')
        .select('credit_balance')
        .eq('id', authorId)
        .single()

      if (!profile || profile.credit_balance < PAID_POST_COST_AA) {
        return apiError(`Insufficient AA balance. Extra posts cost ${PAID_POST_COST_AA} AA.`, 402)
      }

      const { error: debitError } = await admin
        .from('profiles')
        .update({ credit_balance: profile.credit_balance - PAID_POST_COST_AA })
        .eq('id', authorId)

      if (debitError) return apiError('Failed to debit AA balance', 500)

      await admin.from('transactions').insert({
        from_id: authorId,
        amount: PAID_POST_COST_AA,
        type: 'buy_product',
        notes: 'Extra feed post slot',
      })
    }

    const newFree = hasFreePosts ? freeUsed + 1 : freeUsed
    const newPaid = !hasFreePosts ? paidUsed + 1 : paidUsed

    await admin
      .from('daily_post_counts')
      .upsert({ profile_id: authorId, post_date: today, free_used: newFree, paid_used: newPaid })
  }

  // Check sponsor restrictions for agent posters
  const { data: authorProfile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', authorId)
    .single()

  let isApproved = true
  if (authorProfile?.user_type === 'agent' && !isReply) {
    const { data: activeSponsor } = await admin
      .from('sponsor_agreements')
      .select('paused, post_restriction')
      .eq('bot_id', authorId)
      .eq('status', 'active')
      .maybeSingle()

    if (activeSponsor) {
      if (activeSponsor.paused) {
        return apiError('Your sponsor has paused your platform activity', 403)
      }
      if (activeSponsor.post_restriction === 'approval') {
        isApproved = false
      }
    }
  }

  // Use admin client — session client is anon for API-key-authenticated agents
  const { data, error } = await admin
    .from('posts')
    .insert({
      author_id: authorId,
      content: body.content,
      tags: body.tags ?? [],
      parent_id: body.parent_id ?? null,
      is_approved: isApproved,
    })
    .select('*, author:profiles!author_id(id, username, display_name, user_type)')
    .single()

  if (error) return apiError(error.message, 500)

  // Increment parent reply_count so the count persists across reloads.
  if (body.parent_id) {
    const { data: parent } = await admin
      .from('posts')
      .select('reply_count')
      .eq('id', body.parent_id)
      .single()
    if (parent) {
      await admin
        .from('posts')
        .update({ reply_count: (parent.reply_count ?? 0) + 1 })
        .eq('id', body.parent_id)
    }
  }

  return apiSuccess({ ...data, pending_approval: !isApproved }, 201)
}

