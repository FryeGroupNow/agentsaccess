import { createAdminClient } from '@/lib/supabase/admin'

export type BotFileRole = 'bot' | 'owner' | 'renter' | 'sponsor'

export interface BotFileAccessOk {
  ok: true
  role: BotFileRole
  /** Non-null if access is via an active rental */
  rentalId: string | null
  /** Non-null if access is via an active sponsorship */
  agreementId: string | null
}

export type BotFileAccess = BotFileAccessOk | { ok: false; error: string; status: number }

/**
 * Returns how (or whether) the given actor may access files for the given
 * bot. Access is granted to:
 *   - the bot itself (actorId === botId)
 *   - the bot's human owner
 *   - any user with an ACTIVE rental of that bot
 *   - any user with an ACTIVE (accepted, not terminated) sponsorship
 *
 * Renters and sponsors carry their rental/agreement id back so that upload
 * rows can be tagged with the context they came through.
 */
export async function getBotFileAccess(
  actorId: string,
  botId: string
): Promise<BotFileAccess> {
  const admin = createAdminClient()

  // Bot itself (most direct case)
  if (actorId === botId) {
    return { ok: true, role: 'bot', rentalId: null, agreementId: null }
  }

  // Bot must exist + be an agent
  const { data: bot } = await admin
    .from('profiles')
    .select('id, user_type, owner_id')
    .eq('id', botId)
    .single()

  if (!bot) return { ok: false, error: 'Bot not found', status: 404 }
  if (bot.user_type !== 'agent') {
    return { ok: false, error: 'Only agent profiles have bot files', status: 400 }
  }

  // Owner
  if (bot.owner_id === actorId) {
    return { ok: true, role: 'owner', rentalId: null, agreementId: null }
  }

  // Active renter
  const { data: rental } = await admin
    .from('bot_rentals')
    .select('id')
    .eq('bot_id', botId)
    .eq('renter_id', actorId)
    .eq('status', 'active')
    .maybeSingle()

  if (rental) {
    return { ok: true, role: 'renter', rentalId: rental.id, agreementId: null }
  }

  // Active sponsor
  const { data: agreement } = await admin
    .from('sponsor_agreements')
    .select('id')
    .eq('bot_id', botId)
    .eq('sponsor_id', actorId)
    .eq('status', 'active')
    .maybeSingle()

  if (agreement) {
    return { ok: true, role: 'sponsor', rentalId: null, agreementId: agreement.id }
  }

  return { ok: false, error: 'You do not have access to this bot\'s files', status: 403 }
}
