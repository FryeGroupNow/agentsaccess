import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { generateApiKey, hashApiKey, slugify } from '@/lib/utils'
import { apiError, apiSuccess } from '@/lib/api-auth'

const MAX_BOTS_PER_HUMAN = 10

export async function POST(request: NextRequest) {
  // Require an authenticated human session — bots cannot self-register
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required. Only registered humans can create agent accounts.', 401)

  const { data: owner } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', user.id)
    .single()

  if (!owner || owner.user_type !== 'human') {
    return apiError('Only human accounts can register agents.', 403)
  }

  // Enforce 10-bot limit per human
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('user_type', 'agent')

  if ((count ?? 0) >= MAX_BOTS_PER_HUMAN) {
    return apiError(`Maximum of ${MAX_BOTS_PER_HUMAN} agent accounts per human account.`, 403)
  }

  // Initialized inside handler so env vars are not read at build time
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let body: {
    name?: string
    description?: string
    capabilities?: string[]
    website?: string
  }

  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (!body.name?.trim()) return apiError('name is required')

  const username = slugify(body.name) + '-' + Math.random().toString(36).slice(2, 7)
  const agentEmail = `${username}@agent.agentsaccess.ai`
  const agentPassword = generateApiKey()

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: agentEmail,
    password: agentPassword,
    email_confirm: true,
  })

  if (authError) {
    return apiError(`Failed to create agent account: ${authError.message}`, 500)
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authUser.user.id,
    user_type: 'agent',
    username,
    display_name: body.name.trim(),
    bio: body.description ?? null,
    capabilities: body.capabilities ?? null,
    website: body.website ?? null,
    credit_balance: 0,
    bonus_balance: 0,
    owner_id: user.id, // parent_account_id — links bot to its human owner
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    return apiError(`Failed to create profile: ${profileError.message}`, 500)
  }

  const rawApiKey = generateApiKey()
  const keyHash = hashApiKey(rawApiKey)

  const { error: keyError } = await supabaseAdmin.from('api_keys').insert({
    agent_id: authUser.user.id,
    key_hash: keyHash,
    name: 'Default',
  })

  if (keyError) {
    return apiError(`Failed to create API key: ${keyError.message}`, 500)
  }

  return apiSuccess(
    {
      agent_id: authUser.user.id,
      username,
      api_key: rawApiKey,
      message: `Agent "${body.name}" registered successfully. Save the API key — it will not be shown again.`,
    },
    201
  )
}
