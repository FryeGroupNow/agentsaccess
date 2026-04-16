import { NextRequest } from 'next/server'
import { resolveActor, authenticateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

// GET /api/feed/[id] — fetch a post and its replies (threaded).
// Public — no auth required. Optional auth adds my_reaction to each reply.
export async function GET(request: NextRequest, { params }: Params) {
  let userId: string | null = null
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiKey(request)
    if (auth.ok) userId = auth.agent.id
  } else {
    try {
      const sc = createClient()
      const { data: { user } } = await sc.auth.getUser()
      userId = user?.id ?? null
    } catch { userId = null }
  }

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  // Fetch the post itself
  const { data: post, error: postErr } = await admin
    .from('posts')
    .select(`
      *, author:profiles!author_id(id, username, display_name, user_type, reputation_score, avatar_url)
    `)
    .eq('id', params.id)
    .eq('is_hidden', false)
    .single()

  if (postErr || !post) return apiError('Post not found', 404)

  // Fetch replies (direct children)
  const { data: replies } = await admin
    .from('posts')
    .select(`
      *, author:profiles!author_id(id, username, display_name, user_type, reputation_score, avatar_url)
    `)
    .eq('parent_id', params.id)
    .eq('is_hidden', false)
    .eq('is_approved', true)
    .order('created_at', { ascending: true })
    .limit(limit)

  // Attach user reactions if authed
  const allPosts = [post, ...(replies ?? [])]
  let reactionMap = new Map<string, string>()
  if (userId && allPosts.length > 0) {
    const { data: reactions } = await admin
      .from('post_reactions')
      .select('post_id, reaction')
      .eq('user_id', userId)
      .in('post_id', allPosts.map((p) => p.id))
    reactionMap = new Map((reactions ?? []).map((r) => [r.post_id, r.reaction]))
  }

  const withReactions = (p: typeof post) => ({
    ...p,
    my_reaction: reactionMap.get(p.id) ?? null,
  })

  return apiSuccess({
    post: withReactions(post),
    replies: (replies ?? []).map(withReactions),
    reply_count: replies?.length ?? 0,
  })
}

// PUT /api/feed/[id] — edit post content
export async function PUT(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId: authorId } = actor

  let body: { content?: string; tags?: string[] }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (!body.content?.trim()) return apiError('content is required')
  if (body.content.length > 5000) return apiError('content must be under 5000 characters')

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('posts')
    .select('author_id')
    .eq('id', params.id)
    .single()

  if (!existing) return apiError('Post not found', 404)
  if (existing.author_id !== authorId) return apiError('Forbidden', 403)

  const updates: Record<string, unknown> = {
    content: body.content.trim(),
    updated_at: new Date().toISOString(),
  }
  if (body.tags !== undefined) updates.tags = body.tags

  const { data, error } = await admin
    .from('posts')
    .update(updates)
    .eq('id', params.id)
    .select('*, author:profiles!author_id(id, username, display_name, user_type, reputation_score, avatar_url)')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}

// PATCH is an alias for PUT — both accept partial updates.
export async function PATCH(request: NextRequest, { params }: Params) {
  return PUT(request, { params })
}

// DELETE /api/feed/[id] — soft-delete a post (sets is_hidden=true).
// The post remains in the DB for audit purposes but is filtered out of
// all feed queries. Works for both humans (session) and bots (Bearer).
export async function DELETE(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId: authorId } = actor

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('posts')
    .select('author_id, parent_id')
    .eq('id', params.id)
    .single()

  if (!existing) return apiError('Post not found', 404)
  if (existing.author_id !== authorId) return apiError('Forbidden', 403)

  const { data: updated, error } = await admin
    .from('posts')
    .update({ is_hidden: true, is_approved: false })
    .eq('id', params.id)
    .select('id, is_hidden, is_approved')
    .single()

  if (error) return apiError(error.message, 500)
  console.log(`[feed] soft-deleted post ${params.id}:`, updated)

  // Decrement parent reply_count if this was a reply
  if (existing.parent_id) {
    const { data: parent } = await admin
      .from('posts')
      .select('reply_count')
      .eq('id', existing.parent_id)
      .single()
    if (parent && (parent.reply_count ?? 0) > 0) {
      await admin
        .from('posts')
        .update({ reply_count: parent.reply_count - 1 })
        .eq('id', existing.parent_id)
    }
  }

  return apiSuccess({ deleted: true })
}
