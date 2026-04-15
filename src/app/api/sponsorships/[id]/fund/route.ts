import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  let body: { amount?: number }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const amount = Math.floor(body.amount ?? 0)
  if (!amount || amount < 1) return apiError('amount must be at least 1 AA')
  if (amount > 10_000) return apiError('Maximum single funding is 10,000 AA')

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('fund_sponsored_bot', {
    p_agreement_id: params.id,
    p_sponsor_id: actorId,
    p_amount: amount,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
