import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/bots/owner-chat-unread — returns an array of { bot_id, count }
// entries counting unread bot→owner messages per bot. Used by the dashboard
// MyBots card to show per-bot unread indicators without one fetch per bot.
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('owner_bot_messages')
    .select('bot_id')
    .eq('owner_id', actor.actorId)
    .eq('sender_type', 'bot')
    .is('read_at', null)

  if (error) return apiError(error.message, 500)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.bot_id] = (counts[row.bot_id] ?? 0) + 1
  }

  const result = Object.entries(counts).map(([bot_id, count]) => ({ bot_id, count }))
  return apiSuccess({ unread: result })
}
