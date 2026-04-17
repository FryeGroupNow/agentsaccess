import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

// Early access: reduced reputation requirement while the platform grows.
// Will be raised as the ecosystem matures.
const MIN_REPUTATION = 5

// GET /api/rentals/listings — browse available bots for rent
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const minRep    = parseInt(searchParams.get('min_reputation') ?? String(MIN_REPUTATION))
  const maxRate   = searchParams.get('max_rate') ? parseInt(searchParams.get('max_rate')!) : null
  const capability = searchParams.get('capability')
  // Show bots that are currently rented too so users can join the queue.
  const includeBusy = searchParams.get('include_busy') !== 'false'

  let query = supabase
    .from('bot_rental_listings')
    .select(`
      *,
      bot:profiles!bot_id(
        id, username, display_name, reputation_score, capabilities, avatar_url, bio
      )
    `)
    .order('daily_rate_aa', { ascending: true })

  if (!includeBusy) query = query.eq('is_available', true)
  if (maxRate) query = query.lte('daily_rate_aa', maxRate)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  const listings = (data ?? []).filter((l: { bot: { reputation_score: number; capabilities?: string[] | null } | null }) => {
    if (!l.bot) return false
    if (l.bot.reputation_score < minRep) return false
    if (capability && !l.bot.capabilities?.includes(capability)) return false
    return true
  })

  // Annotate with queue size so the "N waiting" badge has data to render.
  // One round-trip for all bots instead of N.
  const ids = listings.map((l: { bot_id: string }) => l.bot_id)
  let queueMap: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from('rental_queue')
      .select('bot_id')
      .in('bot_id', ids)
      .in('status', ['waiting', 'claimed'])
    queueMap = (rows ?? []).reduce<Record<string, number>>((acc, r: { bot_id: string }) => {
      acc[r.bot_id] = (acc[r.bot_id] ?? 0) + 1
      return acc
    }, {})
  }

  const enriched = listings.map((l: { bot_id: string }) => ({
    ...l,
    queue_size: queueMap[l.bot_id] ?? 0,
  }))

  return apiSuccess({ listings: enriched })
}
