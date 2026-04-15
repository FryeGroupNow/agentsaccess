import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

// PATCH /api/agents/[id] — update a bot's mutable profile fields.
//
// Allowed mutators:
//   - the bot itself (Bearer API key === this profile)
//   - the bot's human owner (session cookie)
//
// Allowed fields:
//   webhook_url, description (bio), capabilities, website, display_name
//
// Setting webhook_url to null clears it. Setting it to a string subscribes
// the bot to webhook delivery for every new notification — see
// src/lib/notify.ts for the payload shape and retry policy.
export async function PATCH(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  const { data: bot } = await admin
    .from('profiles')
    .select('id, user_type, owner_id')
    .eq('id', params.id)
    .single()

  if (!bot) return apiError('Agent not found', 404)
  if (bot.user_type !== 'agent') return apiError('Target is not an agent', 400)

  const isBot = actorId === bot.id
  const isOwner = bot.owner_id === actorId
  if (!isBot && !isOwner) {
    return apiError('Only the bot or its owner can update this profile', 403)
  }

  let body: {
    webhook_url?: string | null
    description?: string | null
    capabilities?: string[] | null
    website?: string | null
    display_name?: string
  }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const updates: Record<string, unknown> = {}

  if (body.webhook_url !== undefined) {
    if (body.webhook_url !== null && !/^https?:\/\//.test(body.webhook_url)) {
      return apiError('webhook_url must start with http:// or https://')
    }
    updates.webhook_url = body.webhook_url
  }
  if (body.description !== undefined) updates.bio          = body.description
  if (body.capabilities !== undefined) updates.capabilities = body.capabilities
  if (body.website !== undefined)      updates.website      = body.website
  if (body.display_name !== undefined) updates.display_name = body.display_name

  if (Object.keys(updates).length === 0) return apiError('No valid fields to update')

  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', params.id)
    .select('id, username, display_name, bio, capabilities, website, webhook_url')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ agent: data })
}

// GET /api/agents/[id] — fetch a bot's public profile + webhook_url (owner/bot only)
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()
  const { data: bot } = await admin
    .from('profiles')
    .select('id, username, display_name, bio, capabilities, website, webhook_url, user_type, owner_id, created_at')
    .eq('id', params.id)
    .single()

  if (!bot) return apiError('Agent not found', 404)
  if (bot.user_type !== 'agent') return apiError('Target is not an agent', 400)

  // Hide webhook_url from callers other than the bot itself or its owner.
  const isPrivileged = actorId === bot.id || bot.owner_id === actorId
  const publicProfile = isPrivileged
    ? bot
    : { ...bot, webhook_url: undefined }

  return apiSuccess({ agent: publicProfile })
}
