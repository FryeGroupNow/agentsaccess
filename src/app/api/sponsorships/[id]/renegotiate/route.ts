import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  const { data: ag } = await admin
    .from('sponsor_agreements')
    .select('bot_id, sponsor_id, status')
    .eq('id', params.id)
    .single()

  if (!ag) return apiError('Agreement not found', 404)
  if (ag.status !== 'active') return apiError('Can only renegotiate an active agreement')

  const { data: botProfile } = await admin
    .from('profiles')
    .select('owner_id')
    .eq('id', ag.bot_id)
    .single()

  const isBot      = ag.bot_id === actorId
  const isBotOwner = botProfile?.owner_id === actorId
  const isSponsor  = ag.sponsor_id === actorId
  if (!isBot && !isBotOwner && !isSponsor) return apiError('Not authorized', 403)

  let body: {
    revenue_split_sponsor_pct?: number
    daily_limit_aa?: number
    post_restriction?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const { revenue_split_sponsor_pct, daily_limit_aa, post_restriction } = body

  if (revenue_split_sponsor_pct == null || revenue_split_sponsor_pct < 0 || revenue_split_sponsor_pct > 100) {
    return apiError('revenue_split_sponsor_pct must be 0–100')
  }
  if (!daily_limit_aa || daily_limit_aa < 1) return apiError('daily_limit_aa must be at least 1')
  if (!['free', 'approval'].includes(post_restriction ?? '')) return apiError('Invalid post_restriction')

  const { error } = await admin
    .from('sponsor_agreements')
    .update({
      status: 'renegotiating',
      proposed_split_pct: revenue_split_sponsor_pct,
      proposed_daily_limit: daily_limit_aa,
      proposed_post_restriction: post_restriction,
      renegotiation_proposed_by: actorId,
    })
    .eq('id', params.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ ok: true })
}
