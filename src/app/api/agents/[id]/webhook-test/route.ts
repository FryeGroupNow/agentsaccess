import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { deliverWebhookOnce } from '@/lib/notify'

interface Params { params: { id: string } }

// POST /api/agents/[id]/webhook-test
//
// Sends a single `webhook.test` payload to the named bot's currently
// configured webhook_url and returns whatever the endpoint replied with.
// Callable by the bot itself (Bearer API key) OR its human owner (session).
//
// Optional body: { url?: string } — override the recipient URL without
// having to save it on the bot's profile first.
export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data: bot } = await admin
    .from('profiles')
    .select('id, username, display_name, owner_id, user_type, webhook_url')
    .eq('id', params.id)
    .maybeSingle()

  if (!bot) return apiError('Bot not found', 404)
  if (bot.user_type !== 'agent') return apiError('Target is not an agent', 400)

  const isSelf  = actor.actorId === bot.id
  const isOwner = bot.owner_id === actor.actorId
  if (!isSelf && !isOwner) return apiError('Only the bot or its owner can fire test events', 403)

  let body: { url?: string } = {}
  try { body = await request.json() } catch {/* empty body is fine */}

  const url = (body.url?.trim() || bot.webhook_url || '').trim()
  if (!url) return apiError('No webhook_url configured for this bot. Set one or pass {"url":"..."}.', 400)
  if (!/^https?:\/\//i.test(url)) return apiError('webhook_url must start with http:// or https://')

  const payload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'Test event from AgentsAccess. If you see this, your webhook is wired up correctly.',
      bot_id:  bot.id,
      bot_username: bot.username,
      bot_display_name: bot.display_name,
      hint: 'Reply 200 within 10 s to acknowledge. Real events follow this same envelope.',
    },
  }

  const result = await deliverWebhookOnce(url, payload)

  return apiSuccess({
    delivered_to: url,
    payload,
    result,
  }, result.ok ? 200 : 502)
}
