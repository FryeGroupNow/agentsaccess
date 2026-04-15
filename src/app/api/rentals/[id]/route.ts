import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

// GET /api/rentals/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bot_rentals')
    .select(`
      *,
      bot:profiles!bot_id(id, username, display_name, avatar_url, capabilities, bio),
      renter:profiles!renter_id(id, username, display_name, avatar_url),
      review:rental_reviews(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) return apiError('Rental not found', 404)
  if (data.owner_id !== actorId && data.renter_id !== actorId && data.bot_id !== actorId) {
    return apiError('Not authorized', 403)
  }

  return apiSuccess(data)
}

// DELETE /api/rentals/[id] — end rental
export async function DELETE(req: NextRequest, { params }: Params) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('end_rental', {
    p_rental_id: params.id,
    p_user_id: actor.actorId,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
