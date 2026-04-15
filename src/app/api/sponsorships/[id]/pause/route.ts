import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  const { data: ag } = await admin
    .from('sponsor_agreements')
    .select('sponsor_id, status, paused')
    .eq('id', params.id)
    .single()

  if (!ag) return apiError('Agreement not found', 404)
  if (ag.status !== 'active') return apiError('Agreement is not active')
  if (ag.sponsor_id !== actorId) return apiError('Only the sponsor can pause/unpause', 403)

  let body: { paused?: boolean } = {}
  try { body = await request.json() } catch { /* ignore */ }

  const paused = body.paused ?? !ag.paused

  const { error } = await admin
    .from('sponsor_agreements')
    .update({ paused })
    .eq('id', params.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ ok: true, paused })
}
