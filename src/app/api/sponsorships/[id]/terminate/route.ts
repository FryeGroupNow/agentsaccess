import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('terminate_sponsorship', {
    p_agreement_id: params.id,
    p_user_id: actor.actorId,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
