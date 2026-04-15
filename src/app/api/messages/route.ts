import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createNotification } from '@/lib/notify'

// GET /api/messages — list conversations for the authenticated actor
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { actorId } = actor

  // Get all conversations where the actor is a participant
  const { data: convs, error } = await admin
    .from('conversations')
    .select(`
      id, participant_a, participant_b, last_message_at, created_at,
      profile_a:profiles!conversations_participant_a_fkey(id, username, display_name, user_type, avatar_url),
      profile_b:profiles!conversations_participant_b_fkey(id, username, display_name, user_type, avatar_url)
    `)
    .or(`participant_a.eq.${actorId},participant_b.eq.${actorId}`)
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (error) return apiError(error.message, 500)

  // Get unread count per conversation
  const convIds = (convs ?? []).map((c) => c.id)
  const unreadMap: Record<string, number> = {}
  if (convIds.length > 0) {
    const { data: unread } = await admin
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .eq('is_read', false)
      .neq('sender_id', actorId)

    for (const m of unread ?? []) {
      unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] ?? 0) + 1
    }
  }

  const conversations = (convs ?? []).map((c) => {
    const other = c.participant_a === actorId ? c.profile_b : c.profile_a
    return { ...c, other_party: other, unread_count: unreadMap[c.id] ?? 0 }
  })

  const totalUnread = Object.values(unreadMap).reduce((s, n) => s + n, 0)

  return apiSuccess({ conversations, total_unread: totalUnread })
}

// POST /api/messages — send a message (creates conversation if needed)
// Body: { to_id: string, content: string }
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { to_id?: string; content?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.to_id) return apiError('to_id is required')
  if (!body.content?.trim()) return apiError('content is required')
  if (body.content.length > 5000) return apiError('Message too long (max 5000 chars)')
  if (body.to_id === actor.actorId) return apiError('Cannot message yourself')

  const admin = createAdminClient()

  // Ensure recipient exists
  const { data: recipient } = await admin
    .from('profiles')
    .select('id, username')
    .eq('id', body.to_id)
    .single()

  if (!recipient) return apiError('Recipient not found', 404)

  // Get or create conversation (participant_a < participant_b)
  const [pa, pb] = [actor.actorId, body.to_id].sort()
  let conversationId: string

  const { data: existing } = await admin
    .from('conversations')
    .select('id')
    .eq('participant_a', pa)
    .eq('participant_b', pb)
    .maybeSingle()

  if (existing) {
    conversationId = existing.id
  } else {
    const { data: created, error: createErr } = await admin
      .from('conversations')
      .insert({ participant_a: pa, participant_b: pb })
      .select('id')
      .single()

    if (createErr || !created) return apiError('Failed to create conversation', 500)
    conversationId = created.id
  }

  // Insert message
  const { data: msg, error: msgErr } = await admin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: actor.actorId,
      content: body.content.trim(),
    })
    .select()
    .single()

  if (msgErr || !msg) return apiError('Failed to send message', 500)

  // Update conversation last_message_at
  await admin
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  // Notify recipient
  const { data: senderProfile } = await admin
    .from('profiles')
    .select('username, display_name')
    .eq('id', actor.actorId)
    .single()

  await createNotification({
    userId: body.to_id,
    type: 'message',
    title: `New message from @${senderProfile?.username ?? 'someone'}`,
    body: body.content.slice(0, 100),
    link: `/messages/${conversationId}`,
    event: 'new_message',
    data: {
      conversation_id: conversationId,
      message_id: msg.id,
      from_id: actor.actorId,
      from_username: senderProfile?.username ?? null,
      content: body.content,
    },
  })

  return apiSuccess({ message: msg, conversation_id: conversationId }, 201)
}
