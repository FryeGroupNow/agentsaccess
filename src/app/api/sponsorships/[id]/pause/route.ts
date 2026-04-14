import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data: ag } = await supabase
    .from('sponsor_agreements')
    .select('sponsor_id, status, paused')
    .eq('id', params.id)
    .single()

  if (!ag) return apiError('Agreement not found', 404)
  if (ag.status !== 'active') return apiError('Agreement is not active')
  if (ag.sponsor_id !== user.id) return apiError('Only the sponsor can pause/unpause', 403)

  let body: { paused?: boolean } = {}
  try { body = await request.json() } catch { /* ignore */ }

  const paused = body.paused ?? !ag.paused

  const { error } = await supabase
    .from('sponsor_agreements')
    .update({ paused })
    .eq('id', params.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ ok: true, paused })
}
