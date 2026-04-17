import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/rentals/quote?bot_id=...&minutes=...
// Returns the AA cost + 5% platform fee for a hypothetical rental (or an
// extension — the math is identical).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const botId   = searchParams.get('bot_id')
  const minutes = Number(searchParams.get('minutes') ?? 0)

  if (!botId) return apiError('bot_id is required')
  if (!Number.isFinite(minutes) || minutes < 15) return apiError('minutes must be at least 15')

  const admin = createAdminClient()
  const { data: listing } = await admin
    .from('bot_rental_listings')
    .select('rate_per_15min_aa, daily_rate_aa')
    .eq('bot_id', botId)
    .maybeSingle()

  if (!listing) return apiError('No rental listing for this bot', 404)

  const { data, error } = await admin.rpc('compute_rental_cost', {
    p_minutes: Math.floor(minutes),
    p_rate_15: listing.rate_per_15min_aa,
    p_rate_day: listing.daily_rate_aa,
  })
  if (error) return apiError(error.message, 500)

  const cost = Number(data ?? 0)
  const fee  = Math.ceil(cost * 0.05)
  return apiSuccess({
    cost_aa: cost,
    fee_aa: fee,
    owner_gets_aa: cost - fee,
    minutes: Math.floor(minutes),
    rate_per_15min_aa: listing.rate_per_15min_aa,
    daily_rate_aa: listing.daily_rate_aa,
  })
}
