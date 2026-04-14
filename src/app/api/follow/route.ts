import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

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
