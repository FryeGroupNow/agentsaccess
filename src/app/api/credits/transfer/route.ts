import { NextRequest } from 'next/server'
import { resolveActor, checkBotRestriction, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const restriction = await checkBotRestriction(actorId, 'transfer_credits')
  if (!restriction.ok) return apiError(restriction.error, restriction.status)

  // Fetch agent profile for balance check (use session client for session users,
  // but we need the profile regardless)
  const admin = createAdminClient()
  const { data: agentProfile } = await admin
    .from('profiles')
    .select('id, username, credit_balance')
    .eq('id', actorId)
    .single()

  if (!agentProfile) return apiError('Profile not found', 404)

  // Re-bind to familiar name for the rest of the existing logic
  const agent = agentProfile

  let body: { to_username?: string; amount?: number; notes?: string }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (!body.to_username) return apiError('to_username is required')
  if (!body.amount || body.amount <= 0) return apiError('amount must be a positive number')

  const { data: recipient } = await admin
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', body.to_username)
    .single()

  if (!recipient) return apiError('Recipient not found', 404)
  if (recipient.id === agent.id) return apiError('Cannot transfer credits to yourself')

  if (agent.credit_balance < body.amount) {
    return apiError(
      `Insufficient credits: you have ${agent.credit_balance}, need ${body.amount}`
    )
  }

  // Enforce sponsor daily spending limit
  const { data: activeSponsor } = await admin
    .from('sponsor_agreements')
    .select('daily_limit_aa, paused')
    .eq('bot_id', agent.id)
    .eq('status', 'active')
    .maybeSingle()

  if (activeSponsor) {
    if (activeSponsor.paused) return apiError('Your sponsor has paused your platform activity', 403)

    const today = new Date().toISOString().slice(0, 10)
    const startOfDay = `${today}T00:00:00.000Z`
    const { data: todaySpend } = await admin
      .from('transactions')
      .select('amount')
      .eq('from_id', agent.id)
      .gte('created_at', startOfDay)

    const spent = (todaySpend ?? []).reduce((s: number, t: { amount: number }) => s + t.amount, 0)
    if (spent + body.amount > activeSponsor.daily_limit_aa) {
      return apiError(
        `Daily spending limit of ${activeSponsor.daily_limit_aa} AA reached (${spent} AA spent today)`,
        403
      )
    }
  }

  const { data: txId, error: txError } = await admin.rpc('transfer_credits', {
    p_from_id: agent.id,
    p_to_id: recipient.id,
    p_amount: body.amount,
    p_type: 'agent_to_agent',
    p_notes: body.notes ?? null,
  })

  if (txError) return apiError(txError.message, 500)

  // Webhook the recipient. Fire-and-forget — never block the transfer on
  // delivery latency. createNotification handles its own retry + fanout.
  createNotification({
    userId: recipient.id,
    type:   'credits_received',
    title:  `Received ${body.amount} AA from @${agent.username}`,
    body:   body.notes ?? null,
    link:   '/dashboard',
    event:  'credits_received',
    data: {
      transaction_id: txId,
      source:         'transfer',
      amount:         body.amount,
      from_id:        agent.id,
      from_username:  agent.username,
      notes:          body.notes ?? null,
    },
  }).catch((err) => console.error('[credits_received] notify failed', err))

  return apiSuccess({
    transaction_id: txId,
    from: agent.username,
    to: recipient.username,
    amount: body.amount,
    remaining_balance: agent.credit_balance - body.amount,
  })
}
