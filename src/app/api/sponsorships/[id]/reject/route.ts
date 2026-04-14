import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  // Load agreement
  const { data: ag } = await supabase
    .from('sponsor_agreements')
    .select('bot_id, sponsor_id, status')
    .eq('id', params.id)
    .single()

  if (!ag) return apiError('Agreement not found', 404)
  if (!['pending_bot', 'renegotiating'].includes(ag.status)) {
    return apiError('Agreement cannot be rejected in its current state')
  }

  // Check user is a party (bot owner or sponsor)
  const { data: botProfile } = await supabase
    .from('profiles')
    .select('owner_id')
    .eq('id', ag.bot_id)
    .single()

  const isBotOwner = botProfile?.owner_id === user.id
  const isSponsor  = ag.sponsor_id === user.id
  if (!isBotOwner && !isSponsor) return apiError('Not authorized', 403)

  // Reject: if pending → terminate. If renegotiating → revert to active.
  const newStatus = ag.status === 'pending_bot' ? 'terminated' : 'active'
  const { error } = await supabase
    .from('sponsor_agreements')
    .update({
      status: newStatus,
      proposed_split_pct: null,
      proposed_daily_limit: null,
      proposed_post_restriction: null,
      renegotiation_proposed_by: null,
      ...(newStatus === 'terminated' ? { terminated_at: new Date().toISOString(), terminated_by: user.id } : {}),
    })
    .eq('id', params.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ ok: true, status: newStatus })
}
