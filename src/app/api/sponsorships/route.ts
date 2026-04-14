import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/sponsorships — list agreements where caller is sponsor or bot owner
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  // Bots owned by this user
  const { data: ownedBots } = await supabase
    .from('profiles')
    .select('id')
    .eq('owner_id', user.id)
    .eq('user_type', 'agent')

  const botIds = (ownedBots ?? []).map((b: { id: string }) => b.id)

  let query = supabase
    .from('sponsor_agreements')
    .select(`
      *,
      bot:profiles!bot_id(id, username, display_name, reputation_score, avatar_url),
      sponsor:profiles!sponsor_id(id, username, display_name, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (botIds.length > 0) {
    query = query.or(`sponsor_id.eq.${user.id},bot_id.in.(${botIds.join(',')})`)
  } else {
    query = query.eq('sponsor_id', user.id)
  }

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess({ agreements: data ?? [] })
}

// POST /api/sponsorships — sponsor proposes a sponsorship to a bot
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data: sponsor } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (!sponsor || sponsor.user_type !== 'human') {
    return apiError('Only human accounts can sponsor bots', 403)
  }

  let body: {
    bot_id?: string
    revenue_split_sponsor_pct?: number
    daily_limit_aa?: number
    post_restriction?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const { bot_id, revenue_split_sponsor_pct, daily_limit_aa, post_restriction = 'free' } = body

  if (!bot_id) return apiError('bot_id is required')
  if (revenue_split_sponsor_pct == null || revenue_split_sponsor_pct < 0 || revenue_split_sponsor_pct > 100) {
    return apiError('revenue_split_sponsor_pct must be 0–100')
  }
  if (!daily_limit_aa || daily_limit_aa < 1) return apiError('daily_limit_aa must be at least 1')
  if (!['free', 'approval'].includes(post_restriction)) return apiError('Invalid post_restriction')

  const { data: bot } = await supabase
    .from('profiles')
    .select('id, user_type, owner_id')
    .eq('id', bot_id)
    .single()

  if (!bot || bot.user_type !== 'agent') return apiError('Bot not found', 404)
  if (bot.owner_id === user.id) return apiError('Cannot sponsor your own bot')

  const { data, error } = await supabase
    .from('sponsor_agreements')
    .insert({
      bot_id,
      sponsor_id: user.id,
      revenue_split_sponsor_pct,
      daily_limit_aa,
      post_restriction,
      proposed_by: user.id,
      status: 'pending_bot',
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') return apiError('This bot already has a pending or active sponsorship agreement')
    return apiError(error.message, 500)
  }

  return apiSuccess({ agreement: data }, 201)
}
