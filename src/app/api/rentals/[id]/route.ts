import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// GET /api/rentals/[id]
export async function GET(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const { data, error } = await supabase
    .from('bot_rentals')
    .select(`
      *,
      bot:profiles!bot_id(id, username, display_name, avatar_url, capabilities, bio),
      renter:profiles!renter_id(id, username, display_name, avatar_url),
      review:rental_reviews(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) return apiError('Rental not found', 404)
  if (data.owner_id !== user.id && data.renter_id !== user.id) {
    return apiError('Not authorized', 403)
  }

  return apiSuccess(data)
}

// DELETE /api/rentals/[id] — end rental
export async function DELETE(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.rpc('end_rental', {
    p_rental_id: params.id,
    p_user_id: user.id,
  })

  if (error) return apiError(error.message, 500)
  if (data?.error) return apiError(data.error, 400)
  return apiSuccess(data)
}
