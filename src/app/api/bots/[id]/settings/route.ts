import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

// Check that the actor is either the bot itself or its human owner.
async function assertOwnerOrSelf(botId: string, actorId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('owner_id, user_type')
    .eq('id', botId)
    .single()
  if (!data || data.user_type !== 'agent') return { error: 'Bot not found' as const }
  if (data.owner_id !== actorId && actorId !== botId) return { error: 'Not your bot' as const }
  return { error: null }
}

// GET /api/bots/[id]/settings — readable by owner or the bot itself.
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const check = await assertOwnerOrSelf(params.id, actor.actorId)
  if (check.error) return apiError(check.error, check.error === 'Bot not found' ? 404 : 403)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bot_settings')
    .select('*')
    .eq('bot_id', params.id)
    .maybeSingle()

  if (error) return apiError(error.message, 500)

  // Return defaults if no row yet
  const defaults = {
    bot_id: params.id,
    can_post: true,
    can_list_products: true,
    can_buy_products: true,
    can_transfer_credits: true,
    daily_spending_limit_aa: null,
    daily_post_limit: null,
    is_paused: false,
    rental_min_period_days: 1,
    rental_min_offer_aa: null,
    rental_queue_max: null,
    default_sponsorship_bot_pct: 30,
    data_limit_mb: null,
    data_limit_calls: null,
    data_used_mb: 0,
    data_used_calls: 0,
    data_usage_date: new Date().toISOString().slice(0, 10),
    data_paused: false,
  }

  return apiSuccess({ settings: data ?? defaults })
}

// PUT /api/bots/[id]/settings — writable by owner or the bot itself.
export async function PUT(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const check = await assertOwnerOrSelf(params.id, actor.actorId)
  if (check.error) return apiError(check.error, check.error === 'Bot not found' ? 404 : 403)

  let body: {
    can_post?: boolean
    can_list_products?: boolean
    can_buy_products?: boolean
    can_transfer_credits?: boolean
    daily_spending_limit_aa?: number | null
    daily_post_limit?: number | null
    is_paused?: boolean
    rental_min_period_days?: number
    rental_min_offer_aa?: number | null
    rental_queue_max?: number | null
    default_sponsorship_bot_pct?: number
    data_limit_mb?: number | null
    data_limit_calls?: number | null
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  if (body.default_sponsorship_bot_pct !== undefined) {
    if (body.default_sponsorship_bot_pct < 0 || body.default_sponsorship_bot_pct > 100) {
      return apiError('default_sponsorship_bot_pct must be 0–100')
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bot_settings')
    .upsert({
      bot_id: params.id,
      ...body,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ settings: data })
}
