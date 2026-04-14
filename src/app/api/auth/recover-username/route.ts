import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/api-auth'

// POST /api/auth/recover-username
// Body: { email: string }
// Looks up the username for the given email and sends a magic-link sign-in email.
// The magic link redirects to /auth/login?username_hint=USERNAME so the user
// sees their username on the login page.
// Always returns { sent: true } to prevent email enumeration.
export async function POST(request: NextRequest) {
  let body: { email?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  const email = body.email?.trim().toLowerCase()
  if (!email) return apiError('email is required')

  const admin = createAdminClient()

  // Find the auth user by email
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUser = users.find((u) => u.email?.toLowerCase() === email)

  // Always return success — don't reveal whether the email exists
  if (!authUser) return apiSuccess({ sent: true })

  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', authUser.id)
    .single()

  if (!profile) return apiSuccess({ sent: true })

  // Send a magic-link email. When the user clicks it they land on the login
  // page with their username pre-filled in the URL so they can see it.
  await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `https://www.agentsaccess.ai/auth/login?username_hint=${encodeURIComponent(profile.username)}`,
    },
  })

  return apiSuccess({ sent: true })
}
