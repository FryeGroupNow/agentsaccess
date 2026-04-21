import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

interface Params { params: { id: string } }

// GET /api/rentals/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()
  // Expire any rentals whose clock ran out — keeps clients in sync without
  // needing a cron job.
  await admin.rpc('expire_due_rentals')

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

// DELETE /api/rentals/[id] — end rental. The RPC also promotes the next
// renter in the queue (if any); we fire notifications here so the next
// person knows they're up.
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

  // Tell the bot (and its owner via fanout) the rental has ended so any
  // background loops can stop processing for this rental_id.
  const { data: rentalRow } = await admin
    .from('bot_rentals')
    .select('bot_id, renter_id, owner_id')
    .eq('id', params.id)
    .maybeSingle()

  if (rentalRow?.bot_id) {
    createNotification({
      userId: rentalRow.bot_id,
      type: 'rental_ended',
      title: 'Rental ended',
      body: 'The rental period is over. Wrap up any in-flight work.',
      link: `/rentals/${params.id}`,
      event: 'rental_ended',
      data: {
        rental_id: params.id,
        ended_by: actor.actorId,
        renter_id: rentalRow.renter_id,
        owner_id: rentalRow.owner_id,
      },
    }).catch((err) => console.error('[end_rental] notify failed', err))
  }

  const promo = data?.promotion
  if (promo && promo.action) {
    const { data: entry } = await admin
      .from('rental_queue')
      .select('id, bot_id, renter_id, desired_duration_minutes, auto_start, pre_loaded_instructions')
      .eq('id', promo.queue_id)
      .maybeSingle()

    if (entry) {
      const { data: bot } = await admin
        .from('profiles')
        .select('display_name, username')
        .eq('id', entry.bot_id)
        .single()

      if (promo.action === 'auto_started' && promo.rental_id) {
        await createNotification({
          userId: entry.renter_id,
          type: 'rental_queue_started',
          title: `Your rental with ${bot?.display_name ?? 'the bot'} has started automatically`,
          body: entry.pre_loaded_instructions
            ? 'Your pre-loaded instructions are already in the rental chat.'
            : `@${bot?.username ?? ''} is yours for ${entry.desired_duration_minutes} minutes.`,
          link: `/rentals/${promo.rental_id}/chat`,
          event: 'rental_queue_started',
          data: { bot_id: entry.bot_id, rental_id: promo.rental_id },
        })
      } else if (promo.action === 'claimed') {
        await createNotification({
          userId: entry.renter_id,
          type: 'rental_queue_claim',
          title: `You're next! ${bot?.display_name ?? 'The bot'} is available`,
          body: `Confirm your rental within 5 minutes — or you lose your spot.`,
          link: `/marketplace/bots`,
          event: 'rental_queue_claim',
          data: {
            bot_id: entry.bot_id,
            queue_id: entry.id,
            claim_deadline: promo.claim_deadline,
            desired_duration_minutes: entry.desired_duration_minutes,
          },
        })
      }
    }
  }

  return apiSuccess(data)
}
