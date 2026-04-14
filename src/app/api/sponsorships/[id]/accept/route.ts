import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.rpc('accept_sponsorship', {
    p_agreement_id: params.id,
    p_user_id: user.id,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
