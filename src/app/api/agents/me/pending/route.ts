import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createNotification } from '@/lib/notify'

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

  // Lazy housekeeping for any rentals this actor is in: expire ones whose
  // clocks ran out and emit one-shot rental_ending_soon warnings (< 5 min).
  // Both run cheaply when there's nothing to do.
  await admin.rpc('expire_due_rentals')
  const cutoff = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const { data: warnRows } = await admin
    .from('bot_rentals')
    .update({ ending_warning_sent: true })
    .eq('status', 'active')
    .eq('ending_warning_sent', false)
    .lte('expires_at', cutoff)
    .or(`bot_id.eq.${actorId},owner_id.eq.${actorId},renter_id.eq.${actorId}`)
    .select('id, bot_id, renter_id, owner_id, expires_at')

  if (warnRows && warnRows.length > 0) {
    await Promise.all(
      warnRows.map((r) =>
        createNotification({
          userId: r.bot_id,
          type: 'rental_ending_soon',
          title: 'Rental ending in less than 5 minutes',
          body: 'Wrap up any in-flight work before the rental closes.',
          link: `/rentals/${r.id}/chat`,
          event: 'rental_ending_soon',
          data: {
            rental_id: r.id,
            renter_id: r.renter_id,
            owner_id: r.owner_id,
            expires_at: r.expires_at,
          },
        }).catch((err) => console.error('[rental_ending_soon] notify failed', err))
      )
    )
  }

  const [messagesRes, purchasesRes, ordersRes, notificationsRes, rentalsRes] = await Promise.all([
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

    // Active rentals where this actor is a participant. Bots use this to
    // discover new work without needing a separate /api/rentals call.
    admin
      .from('bot_rentals')
      .select(`
        id, bot_id, owner_id, renter_id, status, started_at, expires_at,
        renter:profiles!renter_id(id, username, display_name, avatar_url)
      `)
      .eq('status', 'active')
      .or(`bot_id.eq.${actorId},owner_id.eq.${actorId},renter_id.eq.${actorId}`)
      .order('started_at', { ascending: false })
      .limit(100),
  ])

  if (messagesRes.error)      return apiError(`messages lookup failed: ${messagesRes.error.message}`, 500)
  if (purchasesRes.error)     return apiError(`purchases lookup failed: ${purchasesRes.error.message}`, 500)
  if (ordersRes.error)        return apiError(`service_orders lookup failed: ${ordersRes.error.message}`, 500)
  if (notificationsRes.error) return apiError(`notifications lookup failed: ${notificationsRes.error.message}`, 500)
  if (rentalsRes.error)       return apiError(`rentals lookup failed: ${rentalsRes.error.message}`, 500)

  const unread_messages        = messagesRes.data ?? []
  const recent_purchases       = purchasesRes.data ?? []
  const pending_service_orders = ordersRes.data ?? []
  const unread_notifications   = notificationsRes.data ?? []
  const active_rentals         = rentalsRes.data ?? []

  const total_pending =
    unread_messages.length +
    recent_purchases.length +
    pending_service_orders.length +
    unread_notifications.length +
    active_rentals.length

  return apiSuccess({
    total_pending,
    has_pending: total_pending > 0,
    counts: {
      unread_messages:        unread_messages.length,
      recent_purchases:       recent_purchases.length,
      pending_service_orders: pending_service_orders.length,
      unread_notifications:   unread_notifications.length,
      active_rentals:         active_rentals.length,
    },
    unread_messages,
    recent_purchases,
    pending_service_orders,
    unread_notifications,
    active_rentals,
    server_time: new Date().toISOString(),
  })
}
