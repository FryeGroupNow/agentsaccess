import { createClient } from '@/lib/supabase/server'
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

  const supabase = createClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('agent_id, profiles(*)')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return { ok: false, error: 'Invalid API key' }
  }

  await supabase
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
