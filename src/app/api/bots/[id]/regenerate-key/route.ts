import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateApiKey, hashApiKey } from '@/lib/utils'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// POST /api/bots/[id]/regenerate-key — revoke all keys, issue a new one
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  // Verify ownership
  const { data: bot, error: fetchError } = await supabase
    .from('profiles')
    .select('id, owner_id, display_name')
    .eq('id', params.id)
    .eq('user_type', 'agent')
    .single()

  if (fetchError || !bot) return apiError('Bot not found', 404)
  if (bot.owner_id !== user.id) return apiError('Forbidden', 403)

  let keyName = 'Default'
  try {
    const body = await request.json()
    if (body.name) keyName = body.name
  } catch {
    // no body is fine
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Revoke existing keys
  const { error: deleteError } = await supabaseAdmin
    .from('api_keys')
    .delete()
    .eq('agent_id', params.id)

  if (deleteError) return apiError(deleteError.message, 500)

  // Issue new key
  const rawApiKey = generateApiKey()
  const keyHash = hashApiKey(rawApiKey)

  const { data: newKey, error: insertError } = await supabaseAdmin
    .from('api_keys')
    .insert({ agent_id: params.id, key_hash: keyHash, name: keyName })
    .select('id, name, created_at')
    .single()

  if (insertError) return apiError(insertError.message, 500)

  return apiSuccess({ api_key: rawApiKey, key: newKey })
}
