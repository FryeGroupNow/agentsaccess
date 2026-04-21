import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { botId: string } }

// GET /api/rentals/listings/[botId] — public: get listing for a specific bot
export async function GET(_req: NextRequest, { params }: Params) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bot_rental_listings')
    .select('*')
    .eq('bot_id', params.botId)
    .maybeSingle()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ listing: data ?? null })
}

// PUT /api/rentals/listings/[botId] — create or update a rental listing.
// Writable by the bot itself (Bearer API key) or its human owner (session).
export async function PUT(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data: bot } = await admin
    .from('profiles')
    .select('owner_id, reputation_score, user_type')
    .eq('id', params.botId)
    .single()

  if (!bot || bot.user_type !== 'agent') return apiError('Bot not found', 404)
  const isSelf = actor.actorId === params.botId
  const isOwner = bot.owner_id === actor.actorId
  if (!isSelf && !isOwner) return apiError('Not your bot', 403)
  // Early access: reduced reputation requirement while the platform grows.
  if (bot.reputation_score < 5) {
    return apiError('Bot needs a reputation score of at least 5 to be listed for rent (early access threshold)')
  }

  let body: {
    daily_rate_aa?: number
    rate_per_15min_aa?: number
    description?: string
    is_available?: boolean
    data_limit_mb?: number | null
    data_limit_calls?: number | null
    estimated_api_cost_per_15min_aa?: number | null
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const {
    daily_rate_aa, rate_per_15min_aa, description,
    is_available = true, data_limit_mb, data_limit_calls,
    estimated_api_cost_per_15min_aa,
  } = body
  if (!daily_rate_aa || daily_rate_aa < 1) return apiError('daily_rate_aa must be at least 1')
  if (daily_rate_aa > 10_000) return apiError('daily_rate_aa cannot exceed 10,000 AA')
  if (!rate_per_15min_aa || rate_per_15min_aa < 1) return apiError('rate_per_15min_aa must be at least 1')
  if (rate_per_15min_aa > 1_000) return apiError('rate_per_15min_aa cannot exceed 1,000 AA')
  if (estimated_api_cost_per_15min_aa != null && estimated_api_cost_per_15min_aa < 0) {
    return apiError('estimated_api_cost_per_15min_aa cannot be negative')
  }

  // If the caller didn't specify data limits, copy whatever the owner has set
  // on bot_settings so renters see the active limits without extra work.
  let mbLimit = data_limit_mb
  let callsLimit = data_limit_calls
  if (mbLimit === undefined || callsLimit === undefined) {
    const { data: s } = await admin
      .from('bot_settings')
      .select('data_limit_mb, data_limit_calls')
      .eq('bot_id', params.botId)
      .maybeSingle()
    if (mbLimit === undefined)    mbLimit    = s?.data_limit_mb    ?? null
    if (callsLimit === undefined) callsLimit = s?.data_limit_calls ?? null
  }

  const { data, error } = await admin
    .from('bot_rental_listings')
    .upsert({
      bot_id: params.botId,
      daily_rate_aa,
      rate_per_15min_aa,
      description: description ?? null,
      is_available,
      data_limit_mb: mbLimit,
      data_limit_calls: callsLimit,
      estimated_api_cost_per_15min_aa: estimated_api_cost_per_15min_aa ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ listing: data })
}

// DELETE /api/rentals/listings/[botId] — remove a rental listing
export async function DELETE(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data: bot } = await admin
    .from('profiles')
    .select('owner_id, user_type')
    .eq('id', params.botId)
    .single()

  if (!bot || bot.user_type !== 'agent') return apiError('Bot not found', 404)
  const isSelf = actor.actorId === params.botId
  const isOwner = bot.owner_id === actor.actorId
  if (!isSelf && !isOwner) return apiError('Not your bot', 403)

  const { error } = await admin
    .from('bot_rental_listings')
    .delete()
    .eq('bot_id', params.botId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ ok: true })
}
