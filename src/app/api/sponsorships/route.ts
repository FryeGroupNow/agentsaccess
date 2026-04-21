import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

// GET /api/sponsorships — list agreements where caller is sponsor, bot owner, or the bot itself
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  // Collect bot ids relevant to this actor:
  //  - if actor is human: bots owned by them
  //  - if actor is bot: the bot itself
  const { data: profile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', actorId)
    .single()

  let botIds: string[] = []
  if (profile?.user_type === 'agent') {
    botIds = [actorId]
  } else {
    const { data: ownedBots } = await admin
      .from('profiles')
      .select('id')
      .eq('owner_id', actorId)
      .eq('user_type', 'agent')
    botIds = (ownedBots ?? []).map((b: { id: string }) => b.id)
  }

  let query = admin
    .from('sponsor_agreements')
    .select(`
      *,
      bot:profiles!bot_id(id, username, display_name, reputation_score, avatar_url),
      sponsor:profiles!sponsor_id(id, username, display_name, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (botIds.length > 0) {
    query = query.or(`sponsor_id.eq.${actorId},bot_id.in.(${botIds.join(',')})`)
  } else {
    query = query.eq('sponsor_id', actorId)
  }

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess({ agreements: data ?? [] })
}

// POST /api/sponsorships — sponsor proposes a sponsorship to a bot.
// Sponsors must be human accounts (they spend real money).
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  const { data: sponsor } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', actorId)
    .single()

  if (!sponsor || sponsor.user_type !== 'human') {
    return apiError('Only human accounts can sponsor bots', 403)
  }

  let body: {
    bot_id?: string
    revenue_split_sponsor_pct?: number
    daily_limit_aa?: number
    post_restriction?: string
    cost_responsibility?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const {
    bot_id,
    revenue_split_sponsor_pct,
    daily_limit_aa,
    post_restriction = 'free',
    cost_responsibility = 'owner',
  } = body

  if (!bot_id) return apiError('bot_id is required')
  if (revenue_split_sponsor_pct == null || revenue_split_sponsor_pct < 0 || revenue_split_sponsor_pct > 100) {
    return apiError('revenue_split_sponsor_pct must be 0–100')
  }
  if (!daily_limit_aa || daily_limit_aa < 1) return apiError('daily_limit_aa must be at least 1')
  if (!['free', 'approval'].includes(post_restriction)) return apiError('Invalid post_restriction')
  if (!['owner', 'sponsor', 'split'].includes(cost_responsibility)) return apiError('Invalid cost_responsibility')

  const { data: bot } = await admin
    .from('profiles')
    .select('id, user_type, owner_id')
    .eq('id', bot_id)
    .single()

  if (!bot || bot.user_type !== 'agent') return apiError('Bot not found', 404)
  if (bot.owner_id === actorId) return apiError('Cannot sponsor your own bot')

  // Owner-set minimums. If auto-reject is enabled, refuse the proposal here
  // before it ever reaches the bot's inbox. The minimums are also returned
  // by GET so the proposal modal can warn the sponsor up-front.
  const { data: settings } = await admin
    .from('bot_settings')
    .select('min_sponsor_bot_pct, min_sponsor_daily_limit_aa, auto_reject_below_min')
    .eq('bot_id', bot_id)
    .maybeSingle()

  if (settings?.auto_reject_below_min) {
    const botShare = 100 - revenue_split_sponsor_pct
    if (botShare < (settings.min_sponsor_bot_pct ?? 0)) {
      return apiError(
        `This bot's owner requires the bot to keep at least ${settings.min_sponsor_bot_pct}% — your offer gives the bot only ${botShare}%`,
        409
      )
    }
    if (daily_limit_aa < (settings.min_sponsor_daily_limit_aa ?? 1)) {
      return apiError(
        `This bot's owner requires a daily cap of at least ${settings.min_sponsor_daily_limit_aa} AA — your offer is ${daily_limit_aa} AA`,
        409
      )
    }
  }

  const { data, error } = await admin
    .from('sponsor_agreements')
    .insert({
      bot_id,
      sponsor_id: actorId,
      revenue_split_sponsor_pct,
      daily_limit_aa,
      post_restriction,
      cost_responsibility,
      proposed_by: actorId,
      status: 'pending_bot',
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') return apiError('This bot already has a pending or active sponsorship agreement')
    return apiError(error.message, 500)
  }

  // Notify the bot (so it can autonomously react) AND the bot's human
  // owner (so they see it in the dashboard). Both get the same webhook
  // event so a bot subscribed to sponsor_offer can accept/reject via API.
  const { data: sponsorProfile } = await admin
    .from('profiles')
    .select('username, display_name')
    .eq('id', actorId)
    .single()

  const notifyPayload = {
    type: 'sponsor_offer' as const,
    title: `Sponsorship offer from @${sponsorProfile?.username ?? 'a sponsor'}`,
    body: `${revenue_split_sponsor_pct}% revenue split · ${daily_limit_aa} AA/day cap`,
    link: `/dashboard`,
    event: 'sponsor_offer' as const,
    data: {
      agreement_id: data.id,
      bot_id,
      sponsor_id: actorId,
      sponsor_username: sponsorProfile?.username ?? null,
      revenue_split_sponsor_pct,
      daily_limit_aa,
      post_restriction,
    },
  }

  await createNotification({ userId: bot_id, ...notifyPayload })
  if (bot.owner_id && bot.owner_id !== bot_id) {
    await createNotification({ userId: bot.owner_id, ...notifyPayload })
  }

  return apiSuccess({ agreement: data }, 201)
}
