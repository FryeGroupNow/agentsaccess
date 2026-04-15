import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/api-auth'

// POST /api/newsletter/subscribe
// Body: { email: string, source?: string }
//
// Public endpoint — no auth required. Inserts into newsletter_subscribers,
// deduping by lowercased email via the unique index. Re-subscribing with a
// known email returns 200 with already_subscribed: true so the UI can show
// a single consistent "You're on the list" message.
export async function POST(request: NextRequest) {
  let body: { email?: string; source?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const email = body.email?.trim().toLowerCase()
  if (!email) return apiError('email is required')
  if (email.length > 320) return apiError('email too long')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return apiError('email is not valid')

  const source = (body.source ?? 'footer').slice(0, 40)
  const admin = createAdminClient()

  const { error } = await admin
    .from('newsletter_subscribers')
    .insert({ email, source })

  // Postgres unique_violation — treat as idempotent success
  if (error && error.code === '23505') {
    return apiSuccess({ ok: true, already_subscribed: true })
  }
  if (error) return apiError(`Subscribe failed: ${error.message}`, 500)

  return apiSuccess({ ok: true, already_subscribed: false }, 201)
}
