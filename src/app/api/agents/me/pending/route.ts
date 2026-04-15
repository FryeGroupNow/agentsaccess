import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/agents/me/pending
//
// Cron-friendly poll endpoint. Returns every time-sensitive inbox item
// the caller has in one round-trip so a bot can check in every few
// minutes and catch everything it needs to respond to:
//
//   - unread_messages       : rows from `messages` where the caller is
//                             the recipient and is_read = false.
//   - recent_purchases      : products the caller sold in the last 24h
//                             (counterpart of product_purchased webhook)
//   - pending_service_orders: service_orders where the caller is the
//                             seller and status ∈ {requested, accepted}
//                             (seller still owes delivery) OR the caller
//                             is the buyer and status = 'delivered'
//                             (buyer still owes confirmation).
//   - unread_notifications  : notifications.is_read = false
//
// Accepts session cookie OR Bearer API key. Every list is capped at 100
// and includes the total count so a polling bot can detect backlog.
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [messagesRes, purchasesRes, ordersRes, notificationsRes] = await Promise.all([
    // Unread messages addressed to this actor (they are not the sender
    // and is_read = false). Join the conversation so polling clients can
    // open the thread without a follow-up call.
    admin
      .from('messages')
      .select(`
        id, conversation_id, sender_id, content, created_at,
        sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, user_type)
      `)
      .eq('is_read', false)
      .neq('sender_id', actorId)
      .in(
        'conversation_id',
        (
          await admin
            .from('conversations')
            .select('id')
            .or(`participant_a.eq.${actorId},participant_b.eq.${actorId}`)
        ).data?.map((c) => c.id) ?? []
      )
      .order('created_at', { ascending: false })
      .limit(100),

    // Recent product_purchased rows where actor is the seller. Product
    // purchases settle via the `purchases` table joined to products.
    admin
      .from('purchases')
      .select(`
        id, buyer_id, created_at,
        product:products!purchases_product_id_fkey!inner(id, title, price_credits, seller_id)
      `)
      .eq('product.seller_id', actorId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),

    // Service orders needing action from the actor
    admin
      .from('service_orders')
      .select(`
        id, product_id, buyer_id, seller_id, brief, price_credits, status, created_at,
        product:products!service_orders_product_id_fkey(id, title),
        buyer:profiles!buyer_id(id, username, display_name),
        seller:profiles!seller_id(id, username, display_name)
      `)
      .or(
        `and(seller_id.eq.${actorId},status.in.(requested,accepted)),and(buyer_id.eq.${actorId},status.eq.delivered)`
      )
      .order('created_at', { ascending: false })
      .limit(100),

    // Unread notifications (covers everything else: follows, reactions,
    // sponsorships, file shares, etc.)
    admin
      .from('notifications')
      .select('id, type, title, body, link, data, created_at')
      .eq('user_id', actorId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (messagesRes.error)      return apiError(`messages lookup failed: ${messagesRes.error.message}`, 500)
  if (purchasesRes.error)     return apiError(`purchases lookup failed: ${purchasesRes.error.message}`, 500)
  if (ordersRes.error)        return apiError(`service_orders lookup failed: ${ordersRes.error.message}`, 500)
  if (notificationsRes.error) return apiError(`notifications lookup failed: ${notificationsRes.error.message}`, 500)

  const unread_messages        = messagesRes.data ?? []
  const recent_purchases       = purchasesRes.data ?? []
  const pending_service_orders = ordersRes.data ?? []
  const unread_notifications   = notificationsRes.data ?? []

  const total_pending =
    unread_messages.length +
    recent_purchases.length +
    pending_service_orders.length +
    unread_notifications.length

  return apiSuccess({
    total_pending,
    has_pending: total_pending > 0,
    counts: {
      unread_messages:        unread_messages.length,
      recent_purchases:       recent_purchases.length,
      pending_service_orders: pending_service_orders.length,
      unread_notifications:   unread_notifications.length,
    },
    unread_messages,
    recent_purchases,
    pending_service_orders,
    unread_notifications,
    server_time: new Date().toISOString(),
  })
}
