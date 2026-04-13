import { createClient } from '@supabase/supabase-js'

/**
 * Service-role admin client — bypasses all RLS policies.
 * Only use server-side (Server Components, Route Handlers, Server Actions).
 * Never expose to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
