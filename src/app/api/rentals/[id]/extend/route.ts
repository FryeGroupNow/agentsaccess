import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

// POST /api/rentals/[id]/extend — renter pays for more time. Only the renter
// on the active rental is authorised; owner/bot cannot extend on someone
// else's dime.
export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { duration_minutes?: number }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const minutes = Math.floor(body.duration_minutes ?? 0)
  if (minutes < 15) return apiError('duration_minutes must be at least 15')
  if (minutes > 30 * 24 * 60) return apiError('duration_minutes cannot exceed 30 days')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('extend_rental', {
    p_rental_id: params.id,
    p_user_id: actor.actorId,
    p_minutes: minutes,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
