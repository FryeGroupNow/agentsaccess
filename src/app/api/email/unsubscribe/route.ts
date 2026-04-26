import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/email/unsubscribe?token=...&pref=weekly_digest
//
// Token-based unsubscribe — the token is the random hex stored on the user's
// profile (profiles.email_unsub_token, populated lazily on first email).
// We deliberately accept GET so that ordinary email "Unsubscribe" links work
// without a form post; the action is idempotent (flips a JSON pref to 'off').
//
// If `pref` is omitted or 'all', we set every email-capable pref to 'off' —
// what most users mean when they click "Unsubscribe".
//
// Returns a tiny self-contained HTML page so the user sees a confirmation
// rather than raw JSON.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token  = url.searchParams.get('token')?.trim()
  const prefIn = url.searchParams.get('pref')?.trim() || 'all'

  if (!token) return htmlPage('Missing token', 'This unsubscribe link is incomplete. Try clicking the link again from your email.', 400)

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, notification_prefs, display_name')
    .eq('email_unsub_token', token)
    .maybeSingle()

  if (!profile) {
    return htmlPage('Token not recognised', 'We could not match this link to an account. It may have already been used or expired.', 404)
  }

  // Build the new prefs object. We always store the existing JSON and flip
  // either a single key or every email-capable key to 'off' / 'in_app'.
  const current = (profile.notification_prefs as Record<string, string> | null) ?? {}
  const next: Record<string, string> = { ...current }

  if (prefIn === 'all') {
    for (const key of Object.keys(next)) {
      if (next[key] === 'in_app_email') next[key] = 'in_app'
    }
    // Also force the opt-in digest off so we don't email them weekly.
    next.weekly_digest = 'off'
  } else {
    // Single-pref unsubscribe. If they were on in_app_email we drop to in_app
    // so the user still sees the alert in the dashboard. Anything else → off.
    next[prefIn] = current[prefIn] === 'in_app_email' ? 'in_app' : 'off'
  }

  await admin
    .from('profiles')
    .update({ notification_prefs: next })
    .eq('id', profile.id)

  const message = prefIn === 'all'
    ? `You\u2019ve been unsubscribed from all AgentsAccess emails. You\u2019ll still see in-app notifications when you log in.`
    : `You\u2019ve been unsubscribed from "${escapeHtml(prefIn)}" emails.`

  return htmlPage(`You\u2019re unsubscribed`, `${message}<br><br>Changed your mind? <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard" style="color:#4f46e5;">Re-enable in your dashboard</a>.`)
}

function htmlPage(title: string, message: string, status = 200): Response {
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} — AgentsAccess</title>
</head>
<body style="margin:0;padding:48px 16px;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;text-align:center;">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;">
    <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${escapeHtml(title)}</h1>
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
