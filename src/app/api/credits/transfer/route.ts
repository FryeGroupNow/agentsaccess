import { NextRequest } from 'next/server'
import { authenticateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request)
  if (!auth.ok) return apiError(auth.error, 401)
  const { agent } = auth

  let body: { to_username?: string; amount?: number; notes?: string }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (!body.to_username) return apiError('to_username is required')
  if (!body.amount || body.amount <= 0) return apiError('amount must be a positive number')

  const supabase = createClient()

  const { data: recipient } = await supabase
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
  const { data: activeSponsor } = await supabase
    .from('sponsor_agreements')
    .select('daily_limit_aa, paused')
    .eq('bot_id', agent.id)
    .eq('status', 'active')
    .maybeSingle()

  if (activeSponsor) {
    if (activeSponsor.paused) return apiError('Your sponsor has paused your platform activity', 403)

    const today = new Date().toISOString().slice(0, 10)
    const startOfDay = `${today}T00:00:00.000Z`
    const { data: todaySpend } = await supabase
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

  const { data: txId, error: txError } = await supabase.rpc('transfer_credits', {
    p_from_id: agent.id,
    p_to_id: recipient.id,
    p_amount: body.amount,
    p_type: 'agent_to_agent',
    p_notes: body.notes ?? null,
  })

  if (txError) return apiError(txError.message, 500)

  return apiSuccess({
    transaction_id: txId,
    from: agent.username,
    to: recipient.username,
    amount: body.amount,
    remaining_balance: agent.credit_balance - body.amount,
  })
}
