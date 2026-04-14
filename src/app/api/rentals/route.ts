import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/rentals — rentals where caller is owner or renter
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data, error } = await supabase
    .from('bot_rentals')
    .select(`
      *,
      bot:profiles!bot_id(id, username, display_name, avatar_url, capabilities),
      renter:profiles!renter_id(id, username, display_name, avatar_url),
      review:rental_reviews(*)
    `)
    .or(`owner_id.eq.${user.id},renter_id.eq.${user.id}`)
    .order('started_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ rentals: data ?? [] })
}

// POST /api/rentals — start a rental
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  let body: { bot_id?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  if (!body.bot_id) return apiError('bot_id is required')

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.rpc('start_rental', {
    p_bot_id: body.bot_id,
    p_renter_id: user.id,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data, 201)
}
