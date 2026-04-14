import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// GET /api/messages/[id] — get messages in a conversation
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()

  // Verify actor is a participant
  const { data: conv } = await admin
    .from('conversations')
    .select('id, participant_a, participant_b')
    .eq('id', params.id)
    .single()

  if (!conv) return apiError('Conversation not found', 404)
  if (conv.participant_a !== actor.actorId && conv.participant_b !== actor.actorId) {
    return apiError('Not a participant', 403)
  }

  const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') ?? '50'), 200)

  const { data: msgs, error } = await admin
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(id, username, display_name, user_type, avatar_url)')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return apiError(error.message, 500)

  // Mark unread messages as read
  await admin
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', params.id)
    .eq('is_read', false)
    .neq('sender_id', actor.actorId)

  // Get the other party's profile
  const otherId = conv.participant_a === actor.actorId ? conv.participant_b : conv.participant_a
  const { data: other } = await admin
    .from('profiles')
    .select('id, username, display_name, user_type, avatar_url, bio')
    .eq('id', otherId)
    .single()

  return apiSuccess({ messages: msgs ?? [], other_party: other, conversation: conv })
}
