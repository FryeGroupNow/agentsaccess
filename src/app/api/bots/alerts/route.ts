import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiSuccess } from '@/lib/api-auth'

// GET /api/bots/alerts
//
// Aggregate "is anything waiting?" check across all bots owned by the
// caller. Used by the dashboard banner so owners never miss pending work
// their bots have on the platform. Returns a per-bot breakdown:
//
//   {
//     has_alerts: true,
//     total_unread_messages: 4,
//     total_pending_orders:  1,
//     bots: [
//       { id, username, display_name, unread_messages, pending_service_orders }
//     ]
//   }
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()

  // Only humans can own bots.
  const { data: bots } = await admin
    .from('profiles')
    .select('id, username, display_name')
    .eq('owner_id', actor.actorId)
    .eq('user_type', 'agent')

  if (!bots || bots.length === 0) {
    return apiSuccess({
      has_alerts: false,
      total_unread_messages: 0,
      total_pending_orders: 0,
      bots: [],
    })
  }

  const botIds = bots.map((b) => b.id)

  // All conversations involving any of the owner's bots
  const { data: convs } = await admin
    .from('conversations')
    .select('id, participant_a, participant_b')
    .or(
      botIds
        .map((id) => `participant_a.eq.${id},participant_b.eq.${id}`)
        .join(',')
    )

  const convByBot = new Map<string, string[]>() // bot_id -> conv_ids
  for (const c of convs ?? []) {
    const botHere = botIds.find((b) => b === c.participant_a || b === c.participant_b)
    if (!botHere) continue
    const list = convByBot.get(botHere) ?? []
    list.push(c.id)
    convByBot.set(botHere, list)
  }

  const allConvIds = Array.from(new Set((convs ?? []).map((c) => c.id)))

  // Unread messages in those conversations where the bot is NOT the sender
  const { data: unread } = allConvIds.length
    ? await admin
        .from('messages')
        .select('id, conversation_id, sender_id')
        .in('conversation_id', allConvIds)
        .eq('is_read', false)
    : { data: [] }

  // Count per bot
  const unreadCountByBot = new Map<string, number>()
  for (const m of unread ?? []) {
    // The bot is the recipient if one of its conv_ids contains m.conversation_id
    // AND it is not the sender.
    if (botIds.includes(m.sender_id)) continue // bot sent this; not unread for bot
    convByBot.forEach((convIds, botId) => {
      if (convIds.includes(m.conversation_id)) {
        unreadCountByBot.set(botId, (unreadCountByBot.get(botId) ?? 0) + 1)
      }
    })
  }

  // Pending service orders where the bot is seller and status is open,
  // or where the bot is buyer and status is delivered (waiting confirm).
  const { data: orders } = await admin
    .from('service_orders')
    .select('id, seller_id, buyer_id, status')
    .or(
      `seller_id.in.(${botIds.join(',')}),buyer_id.in.(${botIds.join(',')})`
    )
    .in('status', ['requested', 'accepted', 'delivered'])

  const orderCountByBot = new Map<string, number>()
  for (const o of orders ?? []) {
    const botHere = botIds.find((b) => b === o.seller_id || b === o.buyer_id)
    if (!botHere) continue
    // Seller owes delivery on requested/accepted; buyer owes confirm on delivered
    const botIsSeller = o.seller_id === botHere
    const needsAction =
      (botIsSeller && (o.status === 'requested' || o.status === 'accepted')) ||
      (!botIsSeller && o.status === 'delivered')
    if (needsAction) {
      orderCountByBot.set(botHere, (orderCountByBot.get(botHere) ?? 0) + 1)
    }
  }

  const botAlerts = bots.map((b) => ({
    id: b.id,
    username: b.username,
    display_name: b.display_name,
    unread_messages:        unreadCountByBot.get(b.id) ?? 0,
    pending_service_orders: orderCountByBot.get(b.id) ?? 0,
  }))

  const total_unread_messages = botAlerts.reduce((s, b) => s + b.unread_messages, 0)
  const total_pending_orders  = botAlerts.reduce((s, b) => s + b.pending_service_orders, 0)

  return apiSuccess({
    has_alerts: total_unread_messages + total_pending_orders > 0,
    total_unread_messages,
    total_pending_orders,
    bots: botAlerts.filter((b) => b.unread_messages + b.pending_service_orders > 0),
  })
}
