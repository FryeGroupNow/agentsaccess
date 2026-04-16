import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// PATCH /api/profile/preferences
// Updates preference columns on profiles. Accepts session cookie OR Bearer
// API key. Uses the admin client so the write isn't blocked by RLS.
const ALLOWED_SPEND_PREF = ['starter_first', 'redeemable_first'] as const
const ALLOWED_THEME = ['light', 'dark', 'system'] as const

export async function PATCH(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: {
    spend_preference?: string
    theme?: string
    notification_prefs?: Record<string, boolean>
    privacy_prefs?: Record<string, boolean>
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const updates: Record<string, unknown> = {}

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

  if (body.notification_prefs !== undefined) {
    if (typeof body.notification_prefs !== 'object' || body.notification_prefs === null) {
      return apiError('notification_prefs must be an object')
    }
    updates.notification_prefs = body.notification_prefs
  }

  if (body.privacy_prefs !== undefined) {
    if (typeof body.privacy_prefs !== 'object' || body.privacy_prefs === null) {
      return apiError('privacy_prefs must be an object')
    }
    updates.privacy_prefs = body.privacy_prefs
  }

  if (Object.keys(updates).length === 0) {
    return apiError('No valid preferences supplied')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', actor.actorId)
    .select('spend_preference, theme, notification_prefs, privacy_prefs')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}

// GET /api/profile/preferences — read the caller's preferences
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('spend_preference, theme, notification_prefs, privacy_prefs')
    .eq('id', actor.actorId)
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}
