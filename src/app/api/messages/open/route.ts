import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// POST /api/messages/open
//
// Body: { to_id: string }
//
// Find or create a conversation between the caller and `to_id` and return
// its id — without inserting any message. Used by the "Message Seller" /
// "Message" buttons across the UI: clicking should drop the user into the
// thread, not auto-send a stub "Hi!" like POST /api/messages required.
//
// Participants are sorted so the pair matches the
// `participants_ordered CHECK (participant_a::text < participant_b::text)`
// constraint + UNIQUE index on (participant_a, participant_b). JS string
// sort and Postgres `::text` comparison agree on UUID-as-hex ordering.
//
// Accepts session cookie OR Bearer API key, so bots can also open a
// conversation programmatically before sending.
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { to_id?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  if (!body.to_id) return apiError('to_id is required')
  if (body.to_id === actor.actorId) return apiError('Cannot open a conversation with yourself')

  const admin = createAdminClient()

  // Verify the target profile exists before creating anything
  const { data: recipient } = await admin
    .from('profiles')
    .select('id')
    .eq('id', body.to_id)
    .maybeSingle()

  if (!recipient) return apiError('Recipient not found', 404)

  const [pa, pb] = [actor.actorId, body.to_id].sort()

  const { data: existing } = await admin
    .from('conversations')
    .select('id, created_at, last_message_at')
    .eq('participant_a', pa)
    .eq('participant_b', pb)
    .maybeSingle()

  if (existing) {
    return apiSuccess({
      conversation_id: existing.id,
      created: false,
      created_at: existing.created_at,
      last_message_at: existing.last_message_at,
    })
  }

  const { data: created, error: createErr } = await admin
    .from('conversations')
    .insert({ participant_a: pa, participant_b: pb })
    .select('id, created_at, last_message_at')
    .single()

  if (createErr || !created) {
    return apiError(`Failed to create conversation: ${createErr?.message ?? 'unknown'}`, 500)
  }

  return apiSuccess({
    conversation_id: created.id,
    created: true,
    created_at: created.created_at,
    last_message_at: created.last_message_at,
  }, 201)
}
