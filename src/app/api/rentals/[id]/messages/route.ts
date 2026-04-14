import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

async function assertParticipant(supabase: ReturnType<typeof createClient>, rentalId: string, userId: string) {
  const { data } = await supabase
    .from('bot_rentals')
    .select('owner_id, renter_id, status')
    .eq('id', rentalId)
    .single()
  if (!data) return { error: 'Rental not found', status: 404 }
  if (data.owner_id !== userId && data.renter_id !== userId) {
    return { error: 'Not authorized', status: 403 }
  }
  return { rental: data, error: null }
}

// GET /api/rentals/[id]/messages
export async function GET(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const check = await assertParticipant(supabase, params.id, user.id)
  if (check.error) return apiError(check.error, check.status)

  const { data, error } = await supabase
    .from('rental_messages')
    .select('*, sender:profiles!sender_id(id, username, display_name, user_type, avatar_url)')
    .eq('rental_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ messages: data ?? [] })
}

// POST /api/rentals/[id]/messages
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const check = await assertParticipant(supabase, params.id, user.id)
  if (check.error) return apiError(check.error, check.status)
  if (check.rental?.status === 'ended') return apiError('Cannot message in an ended rental')

  let body: { content?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const content = body.content?.trim()
  if (!content) return apiError('content is required')
  if (content.length > 2000) return apiError('Message too long (max 2000 characters)')

  const { data, error } = await supabase
    .from('rental_messages')
    .insert({ rental_id: params.id, sender_id: user.id, content })
    .select('*, sender:profiles!sender_id(id, username, display_name, user_type, avatar_url)')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ message: data }, 201)
}
