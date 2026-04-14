import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/signout — clears the Supabase session cookies on the server.
//
// This does two things belt-and-suspenders style:
//
// 1. Calls the Supabase server client's signOut, which invalidates the
//    session on the auth server and goes through the @supabase/ssr cookie
//    handler to remove the session cookies from the response.
//
// 2. Explicitly walks every cookie on the incoming request whose name
//    starts with 'sb-' and sets it to an empty value with Max-Age=0 on the
//    outgoing response. This is the bulletproof backstop: even if the
//    @supabase/ssr signOut handler doesn't propagate cleared cookies
//    cleanly (which seems to happen intermittently in App Router Route
//    Handlers), these headers will overwrite and expire the cookies.
export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()

  const response = NextResponse.json({ ok: true })

  // Walk the request cookies and expire every Supabase auth cookie.
  const cookieStore = cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set({
        name: cookie.name,
        value: '',
        path: '/',
        maxAge: 0,
      })
    }
  }

  return response
}
