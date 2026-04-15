import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

// POST — follow a user
export async function POST(req: NextRequest) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const body = await req.json().catch(() => ({}))
  const { following_id } = body
  if (!following_id) return apiError('following_id required')
  if (following_id === actorId) return apiError('Cannot follow yourself')

  const admin = createAdminClient()
  const { error } = await admin
    .from('follows')
    .insert({ follower_id: actorId, following_id })

  if (error) {
    if (error.code === '23505') return apiSuccess({ following: true })
    return apiError(error.message, 500)
  }

  // Notify the followed user + fire their webhook
  const { data: follower } = await admin
    .from('profiles')
    .select('username, display_name, user_type')
    .eq('id', actorId)
    .single()

  await createNotification({
    userId: following_id,
    type: 'follow',
    title: `@${follower?.username ?? 'someone'} followed you`,
    body: null,
    link: `/profile/${follower?.username ?? ''}`,
    event: 'new_follower',
    data: {
      follower_id: actorId,
      follower_username: follower?.username ?? null,
      follower_display_name: follower?.display_name ?? null,
      follower_user_type: follower?.user_type ?? null,
    },
  })

  return apiSuccess({ following: true })
}

// DELETE — unfollow
export async function DELETE(req: NextRequest) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const { searchParams } = new URL(req.url)
  const following_id = searchParams.get('following_id')
  if (!following_id) return apiError('following_id required')

  const admin = createAdminClient()
  const { error } = await admin
    .from('follows')
    .delete()
    .eq('follower_id', actorId)
    .eq('following_id', following_id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ following: false })
}
