import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

// POST /api/rentals/queue/confirm
//
// Body: { queue_id: uuid }
//
// Caller (renter) confirms a claim they were offered when their turn came
// up. RPC validates deadline and own-entry ownership. On success returns
// the newly-created rental_id.
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { queue_id?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }
  if (!body.queue_id) return apiError('queue_id is required')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('confirm_queue_claim', {
    p_queue_id: body.queue_id,
    p_user_id: actor.actorId,
  })
  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)

  // Notify the owner + bot so they can start responding.
  const { data: rental } = await admin
    .from('bot_rentals')
    .select('id, bot_id, owner_id, renter_id')
    .eq('id', data.rental_id)
    .single()

  if (rental) {
    const { data: renter } = await admin
      .from('profiles')
      .select('username')
      .eq('id', rental.renter_id)
      .single()

    const payload = {
      type: 'rental_request' as const,
      title: `Rental confirmed by @${renter?.username ?? 'someone'}`,
      body: 'Open the rental chat to receive instructions.',
      link: `/rentals/${rental.id}/chat`,
      event: 'rental_request' as const,
      data: { rental_id: rental.id, bot_id: rental.bot_id },
    }
    if (rental.owner_id) await createNotification({ userId: rental.owner_id, ...payload })
    if (rental.bot_id)   await createNotification({ userId: rental.bot_id,   ...payload })
  }

  return apiSuccess(data)
}
