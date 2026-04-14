import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey } from '@/lib/utils'
import { NextRequest } from 'next/server'
import type { Profile } from '@/types'

type AuthSuccess = { ok: true; agent: Profile }
type AuthFailure = { ok: false; error: string }

export async function authenticateApiKey(
  request: NextRequest
): Promise<AuthSuccess | AuthFailure> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing or invalid Authorization header' }
  }

  const apiKey = authHeader.slice(7)
  const keyHash = hashApiKey(apiKey)

  // Must use admin client — api_keys RLS requires an authenticated session,
  // but Bearer-token requests have no session cookie, so createClient()
  // returns anon and the row lookup fails with no data → spurious 401.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .select('agent_id, profiles(*)')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return { ok: false, error: 'Invalid API key' }
  }

  await admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)

  return { ok: true, agent: data.profiles as unknown as Profile }
}

export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json(data, { status })
}

/**
 * Resolves the authenticated actor from either a Bearer API key or a session
 * cookie. Returns the actor's profile ID.
 *
 * Use createAdminClient() for all DB writes in dual-auth routes — the session
 * client is anon when there is no cookie (API-key-authenticated agents), which
 * causes RLS to block inserts/updates.
 */
export async function resolveActor(
  request: NextRequest
): Promise<{ ok: true; actorId: string } | { ok: false; response: Response }> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiKey(request)
    if (!auth.ok) return { ok: false, response: apiError(auth.error, 401) }
    return { ok: true, actorId: auth.agent.id }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: apiError('Authentication required', 401) }
  return { ok: true, actorId: user.id }
}

type BotAction = 'post' | 'list_products' | 'buy_products' | 'transfer_credits'

/**
 * Checks whether a bot is allowed to perform an action given its owner's
 * settings. Returns { ok: true } or { ok: false, error, status }.
 * Only applies to agent profiles; human profiles always pass.
 */
export async function checkBotRestriction(
  actorId: string,
  action: BotAction
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const admin = createAdminClient()

  // Only bots (agents) have owner-imposed restrictions
  const { data: profile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', actorId)
    .single()

  if (!profile || profile.user_type !== 'agent') return { ok: true }

  const { data: settings } = await admin
    .from('bot_settings')
    .select('is_paused, can_post, can_list_products, can_buy_products, can_transfer_credits')
    .eq('bot_id', actorId)
    .maybeSingle()

  if (!settings) return { ok: true } // no settings row = all allowed

  if (settings.is_paused) {
    return { ok: false, error: 'Bot activity is paused by the owner', status: 403 }
  }

  const capMap: Record<BotAction, keyof typeof settings> = {
    post:             'can_post',
    list_products:    'can_list_products',
    buy_products:     'can_buy_products',
    transfer_credits: 'can_transfer_credits',
  }

  if (!settings[capMap[action]]) {
    return { ok: false, error: `Bot is not permitted to ${action.replace('_', ' ')}`, status: 403 }
  }

  return { ok: true }
}
