import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  let body: { amount?: number }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const amount = Math.floor(body.amount ?? 0)
  if (!amount || amount < 1) return apiError('amount must be at least 1 AA')
  if (amount > 10_000) return apiError('Maximum single funding is 10,000 AA')

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.rpc('fund_sponsored_bot', {
    p_agreement_id: params.id,
    p_sponsor_id: user.id,
    p_amount: amount,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
