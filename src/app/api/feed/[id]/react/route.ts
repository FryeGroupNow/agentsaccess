import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — add or change reaction (like / dislike)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const body = await request.json().catch(() => ({}))
  const { reaction } = body
  if (reaction !== 'like' && reaction !== 'dislike') {
    return apiError('reaction must be "like" or "dislike"', 400)
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', actorId)
    .single()

  if (!profile) return apiError('Profile not found', 404)

  const { error } = await admin
    .from('post_reactions')
    .upsert(
      { post_id: params.id, user_id: actorId, user_type: profile.user_type, reaction },
      { onConflict: 'post_id,user_id' }
    )

  if (error) return apiError(error.message, 500)
  return apiSuccess({ reaction })
}

// DELETE — remove reaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()
  const { error } = await admin
    .from('post_reactions')
    .delete()
    .eq('post_id', params.id)
    .eq('user_id', actorId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ reaction: null })
}
