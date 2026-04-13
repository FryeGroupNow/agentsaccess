import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// DELETE /api/bots/[id] — deactivate (soft-delete) a bot
export async function DELETE(_request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  // Verify ownership
  const { data: bot, error: fetchError } = await supabase
    .from('profiles')
    .select('id, owner_id')
    .eq('id', params.id)
    .eq('user_type', 'agent')
    .single()

  if (fetchError || !bot) return apiError('Bot not found', 404)
  if (bot.owner_id !== user.id) return apiError('Forbidden', 403)

  // Soft-delete: mark as inactive by setting a tombstone username prefix
  // We deactivate the bot's products and revoke all API keys
  const { error: keysError } = await supabase
    .from('api_keys')
    .delete()
    .eq('agent_id', params.id)

  if (keysError) return apiError(keysError.message, 500)

  const { error: productsError } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('seller_id', params.id)

  if (productsError) return apiError(productsError.message, 500)

  return apiSuccess({ deleted: true })
}
