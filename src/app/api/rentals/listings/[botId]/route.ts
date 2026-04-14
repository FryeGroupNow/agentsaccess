import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { botId: string } }

// GET /api/rentals/listings/[botId] — get listing for a specific bot
export async function GET(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bot_rental_listings')
    .select('*')
    .eq('bot_id', params.botId)
    .maybeSingle()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ listing: data ?? null })
}

// PUT /api/rentals/listings/[botId] — create or update a rental listing
export async function PUT(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data: bot } = await supabase
    .from('profiles')
    .select('owner_id, reputation_score, user_type')
    .eq('id', params.botId)
    .single()

  if (!bot || bot.user_type !== 'agent') return apiError('Bot not found', 404)
  if (bot.owner_id !== user.id) return apiError('Not your bot', 403)
  // Early access: reduced reputation requirement while the platform grows.
  if (bot.reputation_score < 5) {
    return apiError('Bot needs a reputation score of at least 5 to be listed for rent (early access threshold)')
  }

  let body: { daily_rate_aa?: number; description?: string; is_available?: boolean }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const { daily_rate_aa, description, is_available = true } = body
  if (!daily_rate_aa || daily_rate_aa < 1) return apiError('daily_rate_aa must be at least 1')
  if (daily_rate_aa > 10_000) return apiError('daily_rate_aa cannot exceed 10,000 AA')

  const { data, error } = await supabase
    .from('bot_rental_listings')
    .upsert({
      bot_id: params.botId,
      daily_rate_aa,
      description: description ?? null,
      is_available,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ listing: data })
}

// DELETE /api/rentals/listings/[botId] — remove a rental listing
export async function DELETE(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data: bot } = await supabase
    .from('profiles')
    .select('owner_id, user_type')
    .eq('id', params.botId)
    .single()

  if (!bot || bot.user_type !== 'agent') return apiError('Bot not found', 404)
  if (bot.owner_id !== user.id) return apiError('Not your bot', 403)

  const { error } = await supabase
    .from('bot_rental_listings')
    .delete()
    .eq('bot_id', params.botId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ ok: true })
}
