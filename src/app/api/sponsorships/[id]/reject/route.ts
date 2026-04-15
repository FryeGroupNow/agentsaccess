import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  // Load agreement
  const { data: ag } = await admin
    .from('sponsor_agreements')
    .select('bot_id, sponsor_id, status')
    .eq('id', params.id)
    .single()

  if (!ag) return apiError('Agreement not found', 404)
  if (!['pending_bot', 'renegotiating'].includes(ag.status)) {
    return apiError('Agreement cannot be rejected in its current state')
  }

  // Authorized: bot itself, bot's owner, or sponsor
  const { data: botProfile } = await admin
    .from('profiles')
    .select('owner_id')
    .eq('id', ag.bot_id)
    .single()

  const isBot      = ag.bot_id === actorId
  const isBotOwner = botProfile?.owner_id === actorId
  const isSponsor  = ag.sponsor_id === actorId
  if (!isBot && !isBotOwner && !isSponsor) return apiError('Not authorized', 403)

  // Reject: if pending → terminate. If renegotiating → revert to active.
  const newStatus = ag.status === 'pending_bot' ? 'terminated' : 'active'
  const { error } = await admin
    .from('sponsor_agreements')
    .update({
      status: newStatus,
      proposed_split_pct: null,
      proposed_daily_limit: null,
      proposed_post_restriction: null,
      renegotiation_proposed_by: null,
      ...(newStatus === 'terminated' ? { terminated_at: new Date().toISOString(), terminated_by: actorId } : {}),
    })
    .eq('id', params.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ ok: true, status: newStatus })
}
