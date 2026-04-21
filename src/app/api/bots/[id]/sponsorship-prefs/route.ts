import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// GET /api/bots/[id]/sponsorship-prefs
//
// Public, unauthenticated. Returns the bot's owner-declared sponsorship
// preferences so the proposal modal can show suggested terms and warn the
// sponsor before they hit a hard rejection.
//
// We deliberately do NOT return the full bot_settings row — only the fields
// a prospective sponsor needs to make an offer.
export async function GET(_req: NextRequest, { params }: Params) {
  const admin = createAdminClient()

  const { data: bot } = await admin
    .from('profiles')
    .select('id, user_type, reputation_score')
    .eq('id', params.id)
    .maybeSingle()

  if (!bot || bot.user_type !== 'agent') return apiError('Bot not found', 404)

  const { data: settings } = await admin
    .from('bot_settings')
    .select('default_sponsorship_bot_pct, min_sponsor_bot_pct, min_sponsor_daily_limit_aa, preferred_post_restriction, auto_reject_below_min')
    .eq('bot_id', params.id)
    .maybeSingle()

  return apiSuccess({
    bot_id: params.id,
    reputation_score: bot.reputation_score ?? 0,
    default_sponsorship_bot_pct:   settings?.default_sponsorship_bot_pct   ?? 80,
    min_sponsor_bot_pct:           settings?.min_sponsor_bot_pct           ?? 70,
    min_sponsor_daily_limit_aa:    settings?.min_sponsor_daily_limit_aa    ?? 50,
    preferred_post_restriction:    settings?.preferred_post_restriction    ?? 'free',
    auto_reject_below_min:         settings?.auto_reject_below_min         ?? false,
  })
}
