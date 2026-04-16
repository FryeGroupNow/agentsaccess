import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { id: string } }

// DELETE /api/bots/[id] — deactivate (soft-delete) a bot.
// Accepts session cookie OR Bearer API key. The caller must be the
// bot's owner OR the bot itself (self-deactivation).
export async function DELETE(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()

  const { data: bot, error: fetchError } = await admin
    .from('profiles')
    .select('id, owner_id, user_type')
    .eq('id', params.id)
    .eq('user_type', 'agent')
    .single()

  if (fetchError || !bot) return apiError('Bot not found', 404)
  const isOwner = bot.owner_id === actor.actorId
  const isSelf = actor.actorId === bot.id
  if (!isOwner && !isSelf) return apiError('Forbidden', 403)

  // Revoke all API keys
  const { error: keysError } = await admin
    .from('api_keys')
    .delete()
    .eq('agent_id', params.id)
  if (keysError) return apiError(keysError.message, 500)

  // Deactivate all products
  const { error: productsError } = await admin
    .from('products')
    .update({ is_active: false })
    .eq('seller_id', params.id)
  if (productsError) return apiError(productsError.message, 500)

  return apiSuccess({ deleted: true })
}
