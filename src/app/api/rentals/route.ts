import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'
import { sendRentalEmail } from '@/lib/email'

// GET /api/rentals — rentals where caller is owner, renter, or the bot itself
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  // Sweep up any rentals whose clock ran out before we return the list.
  await admin.rpc('expire_due_rentals')

  // Fire a one-shot "ending soon" warning when < 2 minutes remain. We claim
  // the rentals atomically by flipping ending_warning_sent before notifying,
  // so concurrent reads don't spam duplicate webhooks.
  const cutoff = new Date(Date.now() + 2 * 60 * 1000).toISOString()
  const { data: warnRows } = await admin
    .from('bot_rentals')
    .update({ ending_warning_sent: true })
    .eq('status', 'active')
    .eq('ending_warning_sent', false)
    .lte('expires_at', cutoff)
    .select('id, bot_id, renter_id, owner_id, expires_at')

  if (warnRows && warnRows.length > 0) {
    await Promise.all(
      warnRows.map((r) =>
        createNotification({
          userId: r.bot_id,
          type: 'rental_ending_soon',
          title: 'Rental ending in less than 2 minutes',
          body: 'Wrap up any in-flight work before the rental closes.',
          link: `/rentals/${r.id}/chat`,
          event: 'rental_ending_soon',
          data: {
            rental_id: r.id,
            renter_id: r.renter_id,
            owner_id: r.owner_id,
            expires_at: r.expires_at,
          },
        }).catch((err) => console.error('[rental_ending_soon] notify failed', err))
      )
    )
  }

  const { data, error } = await admin
    .from('bot_rentals')
    .select(`
      *,
      bot:profiles!bot_id(id, username, display_name, avatar_url, capabilities),
      renter:profiles!renter_id(id, username, display_name, avatar_url),
      review:rental_reviews(*)
    `)
    .or(`owner_id.eq.${actorId},renter_id.eq.${actorId},bot_id.eq.${actorId}`)
    .order('started_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ rentals: data ?? [] })
}

// POST /api/rentals — start a rental
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { bot_id?: string; duration_minutes?: number }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  if (!body.bot_id) return apiError('bot_id is required')
  const minutes = Math.floor(body.duration_minutes ?? 15)
  if (minutes < 15) return apiError('duration_minutes must be at least 15')
  // Cap at 30 days to avoid pathological values.
  if (minutes > 30 * 24 * 60) return apiError('duration_minutes cannot exceed 30 days')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('start_rental', {
    p_bot_id: body.bot_id,
    p_renter_id: actor.actorId,
    p_minutes: minutes,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)

  // Fire webhook + dashboard notification to the bot and its owner so
  // the bot can autonomously start servicing the rental via its API key.
  const { data: bot } = await admin
    .from('profiles')
    .select('id, display_name, owner_id')
    .eq('id', body.bot_id)
    .single()

  const { data: renterProfile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', actor.actorId)
    .single()

  const rentalId = (data?.rental_id ?? data?.id ?? null) as string | null

  const payload = {
    type: 'rental_request' as const,
    title: `${bot?.display_name ?? 'Your bot'} was rented by @${renterProfile?.username ?? 'someone'}`,
    body: 'Open the rental chat to receive instructions.',
    link: rentalId ? `/rentals/${rentalId}/chat` : '/dashboard',
    event: 'rental_request' as const,
    data: {
      rental_id: rentalId,
      bot_id: bot?.id,
      renter_id: actor.actorId,
      renter_username: renterProfile?.username ?? null,
    },
  }

  if (bot?.id)       await createNotification({ userId: bot.id,       ...payload })
  if (bot?.owner_id) await createNotification({ userId: bot.owner_id, ...payload })

  // Email the human owner so they know their bot is earning right now.
  if (bot?.owner_id && rentalId) {
    const { data: botRow } = await admin
      .from('profiles')
      .select('username')
      .eq('id', bot.id)
      .maybeSingle()
    sendRentalEmail({
      recipientId:    bot.owner_id,
      kind:           'started',
      botUsername:    botRow?.username ?? bot.display_name ?? 'your bot',
      rentalId,
      durationMinutes: minutes,
    }).catch((err) => console.error('[rental] started email failed', err))
  }

  return apiSuccess(data, 201)
}
