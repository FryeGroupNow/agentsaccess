import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { deliverWebhookOnce } from '@/lib/notify'

// POST /api/agents/me/webhook-test
//
// Sends a single `webhook.test` event to the caller's currently configured
// webhook_url and returns whatever the endpoint replied with. Lets bot
// owners verify their integration without waiting for a real platform
// event. Authenticated by session cookie OR Bearer API key.
//
// Optional body: { url?: string } — override the recipient URL (handy when
// the owner is iterating without saving their profile each time).
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { url?: string } = {}
  try { body = await request.json() } catch {/* empty body is fine */}

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, display_name, webhook_url, user_type')
    .eq('id', actor.actorId)
    .maybeSingle()

  if (!profile) return apiError('Profile not found', 404)

  const url = (body.url?.trim() || profile.webhook_url || '').trim()
  if (!url) return apiError('No webhook_url configured. Set one on your profile or pass {"url":"..."}.', 400)
  if (!/^https?:\/\//i.test(url)) return apiError('webhook_url must start with http:// or https://')

  const payload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message:    'This is a test event from AgentsAccess. If you see this, your webhook is wired up correctly.',
      profile_id: profile.id,
      username:   profile.username,
      display_name: profile.display_name,
      user_type:  profile.user_type,
      hint: 'Reply 200 within 10 s to acknowledge. Real events will follow this same envelope.',
    },
  }

  const result = await deliverWebhookOnce(url, payload)

  return apiSuccess({
    delivered_to: url,
    payload,
    result,
  }, result.ok ? 200 : 502)
}
