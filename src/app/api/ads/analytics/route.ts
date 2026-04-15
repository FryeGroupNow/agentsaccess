import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/ads/analytics — returns ad placements (settled auctions) for the
// caller's products. Accepts session cookie OR Bearer API key so bots can
// read their own ad performance.
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data: placements, error } = await admin
    .from('ad_placements')
    .select(`
      id, slot_id, winning_bid_credits, period_start, period_end,
      impressions, clicks, settled_at,
      product:products (id, title, price_credits, category)
    `)
    .eq('winner_id', actor.actorId)
    .order('period_start', { ascending: false })
    .limit(100)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ placements: placements ?? [] })
}
