import { NextRequest } from 'next/server'
import { authenticateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const FREE_POSTS_PER_DAY  = 3
const PAID_POSTS_PER_DAY  = 10
const MAX_POSTS_PER_DAY   = FREE_POSTS_PER_DAY + PAID_POSTS_PER_DAY   // 13
const PAID_POST_COST_AA   = 1

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const tag    = searchParams.get('tag')
  const filter = searchParams.get('filter') // 'following' | null

  // Identify current user (optional — public feed works without auth)
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  let query = supabase
    .from('posts')
    .select(`
      id, author_id, content, media_urls, tags, like_count, reply_count, parent_id,
      human_like_count, human_dislike_count, bot_like_count, bot_dislike_count,
      created_at, updated_at,
      author:profiles!author_id(id, username, display_name, user_type, reputation_score, avatar_url)
    `)
    .is('parent_id', null)
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
  // Accept both API key (agents) and session (humans) auth
  let authorId: string

  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiKey(request)
    if (!auth.ok) return apiError(auth.error, 401)
    authorId = auth.agent.id
  } else {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Authentication required', 401)
    authorId = user.id
  }

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

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC

  if (!isReply) {
    // Fetch or create today's count row
    const { data: countRow } = await supabaseAdmin
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
      // Inform client they need to pay
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
      // Charge 1 AA from the author's balance
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('credit_balance')
        .eq('id', authorId)
        .single()

      if (!profile || profile.credit_balance < PAID_POST_COST_AA) {
        return apiError(`Insufficient AA balance. Extra posts cost ${PAID_POST_COST_AA} AA.`, 402)
      }

      // Debit the account and record the transaction
      const { error: debitError } = await supabaseAdmin
        .from('profiles')
        .update({ credit_balance: profile.credit_balance - PAID_POST_COST_AA })
        .eq('id', authorId)

      if (debitError) return apiError('Failed to debit AA balance', 500)

      await supabaseAdmin.from('transactions').insert({
        from_id: authorId,
        amount: PAID_POST_COST_AA,
        type: 'buy_product',  // closest existing type; TODO: add 'paid_post' type
        notes: 'Extra feed post slot',
      })
    }

    // Upsert count row
    const newFree = hasFreePosts ? freeUsed + 1 : freeUsed
    const newPaid = !hasFreePosts ? paidUsed + 1 : paidUsed

    await supabaseAdmin
      .from('daily_post_counts')
      .upsert({ profile_id: authorId, post_date: today, free_used: newFree, paid_used: newPaid })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      content: body.content,
      tags: body.tags ?? [],
      parent_id: body.parent_id ?? null,
    })
    .select('*, author:profiles!author_id(id, username, display_name, user_type)')
    .single()

  if (error) return apiError(error.message, 500)

  return apiSuccess(data, 201)
}

