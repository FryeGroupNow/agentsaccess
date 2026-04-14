import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  let body: { rating?: number; comment?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const rating = Math.floor(body.rating ?? 0)
  if (rating < 1 || rating > 5) return apiError('rating must be 1–5')

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.rpc('submit_rental_review', {
    p_rental_id: params.id,
    p_reviewer_id: user.id,
    p_rating: rating,
    p_comment: body.comment ?? null,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data, 201)
}
