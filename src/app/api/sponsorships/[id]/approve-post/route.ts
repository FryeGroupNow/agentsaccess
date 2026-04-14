import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// GET — list pending posts for sponsor approval
export async function GET(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data: ag } = await supabase
    .from('sponsor_agreements')
    .select('bot_id, sponsor_id, status, post_restriction')
    .eq('id', params.id)
    .single()

  if (!ag) return apiError('Agreement not found', 404)
  if (ag.sponsor_id !== user.id) return apiError('Not the sponsor', 403)
  if (ag.status !== 'active') return apiError('Agreement is not active')
  if (ag.post_restriction !== 'approval') return apiError('Post restriction is not set to approval mode')

  const { data, error } = await supabase
    .from('posts')
    .select('id, content, tags, created_at')
    .eq('author_id', ag.bot_id)
    .eq('is_approved', false)
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ pending_posts: data ?? [] })
}

// POST — approve or reject a pending post
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data: ag } = await supabase
    .from('sponsor_agreements')
    .select('bot_id, sponsor_id, status')
    .eq('id', params.id)
    .single()

  if (!ag) return apiError('Agreement not found', 404)
  if (ag.sponsor_id !== user.id) return apiError('Not the sponsor', 403)
  if (ag.status !== 'active') return apiError('Agreement is not active')

  let body: { post_id?: string; approve?: boolean }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  if (!body.post_id) return apiError('post_id is required')

  // Verify post belongs to bot
  const { data: post } = await supabase
    .from('posts')
    .select('author_id, is_approved')
    .eq('id', body.post_id)
    .single()

  if (!post || post.author_id !== ag.bot_id) return apiError('Post not found or not from this bot', 404)

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (body.approve === false) {
    // Delete rejected post
    await admin.from('posts').delete().eq('id', body.post_id)
    return apiSuccess({ ok: true, action: 'rejected' })
  }

  await admin.from('posts').update({ is_approved: true }).eq('id', body.post_id)
  return apiSuccess({ ok: true, action: 'approved' })
}
