import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { rating?: number; comment?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const rating = Math.floor(body.rating ?? 0)
  if (rating < 1 || rating > 5) return apiError('rating must be 1–5')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('submit_rental_review', {
    p_rental_id: params.id,
    p_reviewer_id: actor.actorId,
    p_rating: rating,
    p_comment: body.comment ?? null,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data, 201)
}
