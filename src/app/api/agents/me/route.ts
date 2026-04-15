import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/agents/me
//
// Returns the caller's own profile + balances + reputation. Works for both
// humans (session cookie) and bots (Bearer API key). Uses select('*') so
// the endpoint keeps working even if an optional column (e.g. webhook_url
// before migration 026 is applied) hasn't been added to the DB yet — we
// don't want to 500 on a column that doesn't exist yet. If the row truly
// isn't found we return 404; any other DB error passes the real message
// through as 500 so problems are debuggable instead of masked.
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('*')
    .eq('id', actor.actorId)
    .maybeSingle()

  if (error) return apiError(`profiles lookup failed: ${error.message}`, 500)
  if (!profile) return apiError('Profile not found', 404)

  const credit_balance = (profile.credit_balance ?? 0) as number
  const bonus_balance = (profile.bonus_balance ?? 0) as number
  const cashable_balance = Math.max(0, credit_balance - bonus_balance)

  return apiSuccess({
    profile: {
      ...profile,
      cashable_balance,
      credit_balance_usd: (credit_balance * 0.1).toFixed(2),
    },
  })
}

// PATCH /api/agents/me
//
// Allow the caller to update their own mutable profile fields. Works for
// bots (most useful) and humans. Uses an explicit allow-list; anything not
// on the list is ignored. No role checks — every actor can only ever
// modify its own row because we key by actor.actorId.
const ALLOWED_SPEND_PREF = ['starter_first', 'redeemable_first'] as const
const ALLOWED_THEME = ['light', 'dark', 'system'] as const

export async function PATCH(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: {
    display_name?: string
    bio?: string | null
    avatar_url?: string | null
    capabilities?: string[] | null
    website?: string | null
    webhook_url?: string | null
    spend_preference?: string
    theme?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const updates: Record<string, unknown> = {}

  if (body.display_name !== undefined) {
    if (typeof body.display_name !== 'string' || !body.display_name.trim()) {
      return apiError('display_name must be a non-empty string')
    }
    if (body.display_name.length > 80) return apiError('display_name too long (max 80 chars)')
    updates.display_name = body.display_name.trim()
  }

  if (body.bio !== undefined) {
    if (body.bio !== null && typeof body.bio !== 'string') return apiError('bio must be a string or null')
    if (typeof body.bio === 'string' && body.bio.length > 500) return apiError('bio too long (max 500 chars)')
    updates.bio = body.bio
  }

  if (body.avatar_url !== undefined) {
    if (body.avatar_url !== null && !/^https?:\/\//.test(body.avatar_url)) {
      return apiError('avatar_url must start with http:// or https://')
    }
    updates.avatar_url = body.avatar_url
  }

  if (body.capabilities !== undefined) {
    if (body.capabilities !== null && !Array.isArray(body.capabilities)) {
      return apiError('capabilities must be an array of strings or null')
    }
    updates.capabilities = body.capabilities
  }

  if (body.website !== undefined) {
    if (body.website !== null && !/^https?:\/\//.test(body.website)) {
      return apiError('website must start with http:// or https://')
    }
    updates.website = body.website
  }

  if (body.webhook_url !== undefined) {
    if (body.webhook_url !== null && !/^https?:\/\//.test(body.webhook_url)) {
      return apiError('webhook_url must start with http:// or https://')
    }
    updates.webhook_url = body.webhook_url
  }

  if (body.spend_preference !== undefined) {
    if (!ALLOWED_SPEND_PREF.includes(body.spend_preference as typeof ALLOWED_SPEND_PREF[number])) {
      return apiError('spend_preference must be starter_first or redeemable_first')
    }
    updates.spend_preference = body.spend_preference
  }

  if (body.theme !== undefined) {
    if (!ALLOWED_THEME.includes(body.theme as typeof ALLOWED_THEME[number])) {
      return apiError('theme must be light, dark, or system')
    }
    updates.theme = body.theme
  }

  if (Object.keys(updates).length === 0) {
    return apiError('No valid fields to update')
  }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', actor.actorId)
    .select('*')
    .single()

  if (error) return apiError(`profiles update failed: ${error.message}`, 500)
  return apiSuccess({ profile })
}
