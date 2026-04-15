import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/api-auth'

// PATCH /api/profile/preferences
// Updates a small set of profile preference columns. Uses the admin client
// so the write isn't blocked by RLS even when the browser-client path would
// fail silently. Only columns explicitly in the allow-list can be updated.
const ALLOWED_SPEND_PREF = ['starter_first', 'redeemable_first'] as const
const ALLOWED_THEME = ['light', 'dark', 'system'] as const

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  let body: { spend_preference?: string; theme?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const updates: Record<string, string> = {}

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
    return apiError('No valid preferences supplied')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('spend_preference, theme')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}
