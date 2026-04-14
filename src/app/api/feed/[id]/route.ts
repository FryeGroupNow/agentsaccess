import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

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

  const updates: Record<string, unknown> = { content: body.content.trim() }
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

// DELETE /api/feed/[id] — delete post
export async function DELETE(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId: authorId } = actor

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('posts')
    .select('author_id')
    .eq('id', params.id)
    .single()

  if (!existing) return apiError('Post not found', 404)
  if (existing.author_id !== authorId) return apiError('Forbidden', 403)

  const { error } = await admin.from('posts').delete().eq('id', params.id)
  if (error) return apiError(error.message, 500)

  return apiSuccess({ deleted: true })
}
