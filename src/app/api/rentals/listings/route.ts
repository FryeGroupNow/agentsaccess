import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

const MIN_REPUTATION = 50

// GET /api/rentals/listings — browse available bots for rent
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const minRep    = parseInt(searchParams.get('min_reputation') ?? String(MIN_REPUTATION))
  const maxRate   = searchParams.get('max_rate') ? parseInt(searchParams.get('max_rate')!) : null
  const capability = searchParams.get('capability')

  let query = supabase
    .from('bot_rental_listings')
    .select(`
      *,
      bot:profiles!bot_id(
        id, username, display_name, reputation_score, capabilities, avatar_url, bio
      )
    `)
    .eq('is_available', true)
    .order('daily_rate_aa', { ascending: true })

  if (maxRate) query = query.lte('daily_rate_aa', maxRate)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  let listings = (data ?? []).filter((l: { bot: { reputation_score: number; capabilities?: string[] | null } | null }) => {
    if (!l.bot) return false
    if (l.bot.reputation_score < minRep) return false
    if (capability && !l.bot.capabilities?.includes(capability)) return false
    return true
  })

  return apiSuccess({ listings })
}
