import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Legacy like endpoint. New code should use /api/feed/[id]/react which
// supports like/dislike and the full reaction breakdown. This route
// remains for backwards compatibility with any external callers still
// hitting the old path.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { error } = await admin
    .from('post_likes')
    .insert({ post_id: params.id, user_id: actor.actorId })

  if (error && error.code !== '23505') return apiError(error.message, 500)
  return apiSuccess({ liked: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { error } = await admin
    .from('post_likes')
    .delete()
    .eq('post_id', params.id)
    .eq('user_id', actor.actorId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ liked: false })
}
