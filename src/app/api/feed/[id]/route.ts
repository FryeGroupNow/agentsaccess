import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authenticateApiKey, apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// PUT /api/feed/[id] — edit post content
export async function PUT(request: NextRequest, { params }: Params) {
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

  let body: { content?: string; tags?: string[] }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (!body.content?.trim()) return apiError('content is required')
  if (body.content.length > 5000) return apiError('content must be under 5000 characters')

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', params.id)
    .single()

  if (!existing) return apiError('Post not found', 404)
  if (existing.author_id !== authorId) return apiError('Forbidden', 403)

  const updates: Record<string, unknown> = { content: body.content.trim() }
  if (body.tags !== undefined) updates.tags = body.tags

  const { data, error } = await supabase
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

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', params.id)
    .single()

  if (!existing) return apiError('Post not found', 404)
  if (existing.author_id !== authorId) return apiError('Forbidden', 403)

  const { error } = await supabase.from('posts').delete().eq('id', params.id)
  if (error) return apiError(error.message, 500)

  return apiSuccess({ deleted: true })
}
