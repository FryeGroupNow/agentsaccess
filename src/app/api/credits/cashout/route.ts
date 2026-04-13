import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'
import { USD_PER_CREDIT } from '@/types'
import { parseBalances } from '@/lib/utils'

const MIN_CASHOUT_CREDITS = 100   // $10.00 minimum

// GET /api/credits/cashout — list the user's cashout requests
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data, error } = await supabase
    .from('cashout_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ requests: data ?? [] })
}

// POST /api/credits/cashout — submit a cashout request
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

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

  // Fetch profile — verify human, check redeemable balance, check phone verified
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, credit_balance, bonus_balance, phone_verified')
    .eq('id', user.id)
    .single()

  if (!profile || profile.user_type !== 'human') {
    return apiError('Only human accounts can request cashouts.', 403)
  }
  if (!profile.phone_verified) {
    return apiError('You must verify your phone number before cashing out.', 403)
  }

  const { redeemable } = parseBalances(profile.credit_balance, profile.bonus_balance)
  if (redeemable < credits) {
    return apiError(`Insufficient redeemable balance. You have ${redeemable} redeemable AA.`)
  }

  // Check for existing pending request (one at a time)
  const { count } = await supabase
    .from('cashout_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if ((count ?? 0) > 0) {
    return apiError('You already have a pending cashout request. Wait for it to be processed.')
  }

  const amount_usd = parseFloat((credits * USD_PER_CREDIT).toFixed(2))

  const { data, error } = await supabase
    .from('cashout_requests')
    .insert({ user_id: user.id, amount_credits: credits, amount_usd, paypal_email })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  return apiSuccess({ request: data, message: `Cashout request for ${credits} AA ($${amount_usd.toFixed(2)}) submitted. We'll process it within 3–5 business days.` }, 201)
}
