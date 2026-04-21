import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createNotification } from '@/lib/notify'

interface Params { params: { id: string } }

// Both humans and bots can read/write rental messages. Humans authenticate
// via session cookies; bots authenticate with Authorization: Bearer <api_key>.
// resolveActor handles both.

async function assertParticipant(rentalId: string, actorId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('bot_rentals')
    .select('owner_id, renter_id, bot_id, status')
    .eq('id', rentalId)
    .single()
  if (!data) return { error: 'Rental not found' as const, status: 404 as const }
  // Participants: renter (the human), owner (the bot's human owner), and the
  // bot itself. The bot's profile id is stored in bot_id.
  if (
    data.owner_id !== actorId &&
    data.renter_id !== actorId &&
    data.bot_id !== actorId
  ) {
    return { error: 'Not authorized' as const, status: 403 as const }
  }
  return { rental: data, error: null as null }
}

// GET /api/rentals/[id]/messages
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const check = await assertParticipant(params.id, actor.actorId)
  if (check.error) return apiError(check.error, check.status)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rental_messages')
    .select('*, sender:profiles!sender_id(id, username, display_name, user_type, avatar_url)')
    .eq('rental_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ messages: data ?? [] })
}

// POST /api/rentals/[id]/messages
export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const check = await assertParticipant(params.id, actor.actorId)
  if (check.error) return apiError(check.error, check.status)
  if (check.rental?.status === 'ended') return apiError('Cannot message in an ended rental')

  let body: { content?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const content = body.content?.trim()
  if (!content) return apiError('content is required')
  if (content.length > 2000) return apiError('Message too long (max 2000 characters)')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rental_messages')
    .insert({ rental_id: params.id, sender_id: actor.actorId, content })
    .select('*, sender:profiles!sender_id(id, username, display_name, user_type, avatar_url)')
    .single()

  if (error) return apiError(error.message, 500)

  // Notify the bot so its polling loop / webhook fires. Only when the
  // sender is NOT the bot itself — otherwise the bot would ping itself.
  if (check.rental && actor.actorId !== check.rental.bot_id) {
    const sender = data.sender as { username?: string; display_name?: string } | null
    createNotification({
      userId: check.rental.bot_id,
      type: 'rental_message',
      title: `New rental message from ${sender?.display_name ?? 'renter'}`,
      body: content.length > 200 ? `${content.slice(0, 197)}...` : content,
      link: `/rentals/${params.id}/chat`,
      event: 'rental_message',
      data: {
        rental_id: params.id,
        message_id: data.id,
        sender_id: actor.actorId,
        sender_username: sender?.username ?? null,
        content,
      },
    }).catch((err) => console.error('[rental_messages] notify failed', err))
  }

  return apiSuccess({ message: data }, 201)
}
