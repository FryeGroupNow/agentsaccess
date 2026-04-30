import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

interface Params { params: { id: string } }

/**
 * Resolve the (owner, bot) participants for a chat channel and verify the
 * actor is one of them. Returns either:
 *   { role: 'owner' | 'bot', ownerId, botId }
 * or an error response.
 */
async function resolveParticipants(actorId: string, botId: string) {
  const admin = createAdminClient()
  const { data: bot } = await admin
    .from('profiles')
    .select('id, user_type, owner_id')
    .eq('id', botId)
    .single()

  if (!bot) return { ok: false as const, response: apiError('Bot not found', 404) }
  if (bot.user_type !== 'agent') {
    return { ok: false as const, response: apiError('Target is not an agent', 400) }
  }
  if (!bot.owner_id) {
    return { ok: false as const, response: apiError('Bot has no owner', 400) }
  }

  if (actorId === bot.owner_id) {
    return { ok: true as const, role: 'owner' as const, ownerId: bot.owner_id, botId: bot.id, admin }
  }
  if (actorId === bot.id) {
    return { ok: true as const, role: 'bot' as const, ownerId: bot.owner_id, botId: bot.id, admin }
  }
  return { ok: false as const, response: apiError('Only the bot and its owner can access this chat', 403) }
}

// GET /api/bots/[id]/owner-chat — list messages in the owner↔bot thread.
// Default returns the last 25 messages (chronological); pass ?limit=N (max
// 200) to widen the window or ?before=ISO to page further back. Marks
// incoming messages as read for the calling party.
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const p = await resolveParticipants(actor.actorId, params.id)
  if (!p.ok) return p.response

  const url = new URL(request.url)
  const limit  = Math.min(Math.max(parseInt(url.searchParams.get('limit')  ?? '25'), 1), 200)
  const before = url.searchParams.get('before')

  // Read the most recent N rows by ordering DESC + limit, then flip back to
  // chronological for the client. The previous implementation pulled every
  // message in the thread on every poll — fine when threads were short,
  // ugly once an active owner ↔ bot conversation accumulates 1000+ rows.
  let q = p.admin
    .from('owner_bot_messages')
    .select('id, bot_id, owner_id, sender_type, content, read_at, created_at')
    .eq('bot_id', p.botId)
    .eq('owner_id', p.ownerId)
    .order('created_at', { ascending: false })
    .limit(limit + 1) // +1 so we can compute has_more cheaply

  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) return apiError(error.message, 500)

  const rows = data ?? []
  const hasMore = rows.length > limit
  const window  = hasMore ? rows.slice(0, limit) : rows
  const messages = window.reverse()

  // Mark the other party's messages as read. Owner marks bot messages read;
  // bot marks owner messages read.
  const otherSender = p.role === 'owner' ? 'bot' : 'owner'
  await p.admin
    .from('owner_bot_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('bot_id', p.botId)
    .eq('owner_id', p.ownerId)
    .eq('sender_type', otherSender)
    .is('read_at', null)

  return apiSuccess({ messages, role: p.role, has_more: hasMore })
}

// POST /api/bots/[id]/owner-chat — send a new message
export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const p = await resolveParticipants(actor.actorId, params.id)
  if (!p.ok) return p.response

  let body: { content?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const content = body.content?.trim()
  if (!content) return apiError('content is required')
  if (content.length > 5000) return apiError('Message too long (max 5000 characters)')

  const { data, error } = await p.admin
    .from('owner_bot_messages')
    .insert({
      bot_id:      p.botId,
      owner_id:    p.ownerId,
      sender_type: p.role,
      content,
    })
    .select('id, bot_id, owner_id, sender_type, content, read_at, created_at')
    .single()

  if (error) return apiError(error.message, 500)

  // Push an owner_message webhook to the bot when the sender is the owner,
  // so the bot can react without polling its owner-chat thread. We only
  // fire for the owner → bot direction; the bot → owner side doesn't need
  // a separate event (the owner reads the thread in the dashboard).
  if (p.role === 'owner') {
    const { data: ownerProfile } = await p.admin
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', p.ownerId)
      .maybeSingle()

    createNotification({
      userId: p.botId,
      type:   'owner_message',
      title:  `Message from @${ownerProfile?.username ?? 'your owner'}`,
      body:   content.length > 200 ? `${content.slice(0, 197)}...` : content,
      link:   `/bots/${p.botId}/chat`,
      event:  'owner_message',
      // Don't mirror back to the owner — they just sent this message.
      skipOwnerFanout: true,
      data: {
        bot_id:              p.botId,
        message_id:          data.id,
        owner_id:            p.ownerId,
        owner_username:      ownerProfile?.username ?? null,
        owner_display_name:  ownerProfile?.display_name ?? null,
        owner_avatar_url:    ownerProfile?.avatar_url ?? null,
        content,
        created_at:          data.created_at,
      },
    }).catch((err) => console.error('[owner_message] notify failed', err))
  }

  return apiSuccess({ message: data }, 201)
}
