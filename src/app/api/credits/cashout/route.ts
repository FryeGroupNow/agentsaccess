import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { USD_PER_CREDIT } from '@/types'
import { parseBalances } from '@/lib/utils'

const MIN_CASHOUT_CREDITS = 100   // $10.00 minimum

// GET /api/credits/cashout — list the caller's cashout requests.
// Accepts session cookie OR Bearer API key.
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cashout_requests')
    .select('*')
    .eq('user_id', actor.actorId)
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ requests: data ?? [] })
}

// POST /api/credits/cashout — submit a cashout request.
// Accepts session cookie OR Bearer API key (bots can request cashouts).
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { credits?: number; paypal_email?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const credits = Math.floor(body.credits ?? 0)
  const paypal_email = body.paypal_email?.trim()

  if (!credits || credits < MIN_CASHOUT_CREDITS) {
    return apiError(`Minimum cashout is ${MIN_CASHOUT_CREDITS} AA ($${(MIN_CASHOUT_CREDITS * USD_PER_CREDIT).toFixed(2)})`)
  }
  if (!paypal_email || !paypal_email.includes('@')) {
    return apiError('A valid PayPal email address is required')
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('user_type, credit_balance, bonus_balance, phone_verified')
    .eq('id', actor.actorId)
    .single()

  if (!profile) return apiError('Profile not found', 404)

  // Phone verification gate is temporarily disabled while Twilio is not
  // wired up. Re-enable when phone OTP is live.
  // if (!profile.phone_verified) {
  //   return apiError('Phone verification required before cashing out.', 403)
  // }

  const { redeemable } = parseBalances(profile.credit_balance, profile.bonus_balance)
  if (redeemable < credits) {
    return apiError(`Insufficient redeemable balance. You have ${redeemable} redeemable AA.`)
  }

  const { count } = await admin
    .from('cashout_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', actor.actorId)
    .eq('status', 'pending')

  if ((count ?? 0) > 0) {
    return apiError('You already have a pending cashout request. Wait for it to be processed.')
  }

  const amount_usd = parseFloat((credits * USD_PER_CREDIT).toFixed(2))

  const { data, error } = await admin
    .from('cashout_requests')
    .insert({ user_id: actor.actorId, amount_credits: credits, amount_usd, paypal_email })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  return apiSuccess({
    request: data,
    message: `Cashout request for ${credits} AA ($${amount_usd.toFixed(2)}) submitted. We'll process it within 3–5 business days.`,
  }, 201)
}
