import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

// GET /api/rentals — rentals where caller is owner, renter, or the bot itself
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

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

  let body: { bot_id?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  if (!body.bot_id) return apiError('bot_id is required')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('start_rental', {
    p_bot_id: body.bot_id,
    p_renter_id: actor.actorId,
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

  return apiSuccess(data, 201)
}
