import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/api-auth'

// POST /api/bots/[id]/withdraw
//
// Moves redeemable AA from a bot's wallet to the human owner who authored
// this request. Cookie-session only — we deliberately do not accept Bearer
// API keys here, because that would let an agent withdraw its own funds,
// which is exactly the opposite of what we want. Only the owner can pull
// credits off the bot.
//
// Body: { amount: number }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  let body: { amount?: number }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const amount = Math.floor(body.amount ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return apiError('amount must be a positive integer')
  if (amount > 1_000_000) return apiError('amount too large')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('withdraw_bot_credits', {
    p_bot_id: params.id,
    p_owner_id: user.id,
    p_amount: amount,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
