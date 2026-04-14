import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/signout — clears the Supabase session cookies on the server.
//
// The browser client's supabase.auth.signOut() only clears localStorage /
// in-memory session state; the httpOnly cookies used by @supabase/ssr stay
// on the response. Calling this endpoint through the server client forces
// those cookies to be removed from the outgoing response, which is what
// actually logs the user out across server components and API routes.
export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
