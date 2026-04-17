import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

// POST /api/rentals/queue — join the queue for a bot.
//
// Body:
//   bot_id                    (uuid, required)
//   duration_minutes          (int, required, >= 15)
//   auto_start                (bool, optional, default false)
//   pre_loaded_instructions   (string, optional; only meaningful when auto_start)
//
// When auto_start is true, credits are pre-charged immediately. The amount
// sits in escrow on the queue row until their turn comes, at which point
// the rental starts automatically.
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: {
    bot_id?: string
    duration_minutes?: number
    auto_start?: boolean
    pre_loaded_instructions?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  if (!body.bot_id) return apiError('bot_id is required')
  const minutes = Math.floor(body.duration_minutes ?? 15)
  if (minutes < 15) return apiError('duration_minutes must be at least 15')
  if (minutes > 30 * 24 * 60) return apiError('duration_minutes cannot exceed 30 days')

  const autoStart = !!body.auto_start
  const instructions = body.pre_loaded_instructions?.trim() || null
  if (instructions && instructions.length > 4000) {
    return apiError('pre_loaded_instructions cannot exceed 4000 characters')
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('join_rental_queue', {
    p_bot_id: body.bot_id,
    p_renter_id: actor.actorId,
    p_duration_minutes: minutes,
    p_auto_start: autoStart,
    p_pre_loaded_instructions: instructions,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)

  // Let the renter know where they stand.
  const { count: waitingCount } = await admin
    .from('rental_queue')
    .select('id', { count: 'exact', head: true })
    .eq('bot_id', body.bot_id)
    .in('status', ['waiting', 'claimed'])

  const { data: bot } = await admin
    .from('profiles')
    .select('display_name, owner_id, username')
    .eq('id', body.bot_id)
    .single()

  await createNotification({
    userId: actor.actorId,
    type: 'rental_queue_joined',
    title: `You joined the queue for ${bot?.display_name ?? 'a bot'}`,
    body: `Position: #${waitingCount ?? '?'}`,
    link: `/marketplace/bots`,
    event: 'rental_queue_joined',
    data: {
      bot_id: body.bot_id,
      queue_id: data?.queue_id,
      position: waitingCount,
      auto_start: autoStart,
    },
  })
  // Give the owner visibility on demand.
  if (bot?.owner_id) {
    await createNotification({
      userId: bot.owner_id,
      type: 'rental_queue_joined',
      title: `Someone joined the queue for @${bot.username}`,
      body: `${waitingCount ?? 0} total in queue · requested ${minutes} min`,
      link: '/dashboard',
      event: 'rental_queue_joined',
      data: { bot_id: body.bot_id, queue_size: waitingCount },
    })
  }

  return apiSuccess({ ...data, position: waitingCount })
}

// DELETE /api/rentals/queue?bot_id=... — leave the queue for a bot.
export async function DELETE(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const { searchParams } = new URL(request.url)
  const botId = searchParams.get('bot_id')
  if (!botId) return apiError('bot_id is required')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('leave_rental_queue', {
    p_bot_id: botId,
    p_renter_id: actor.actorId,
  })
  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
