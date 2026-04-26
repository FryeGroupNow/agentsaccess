import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

interface Params { params: { id: string } }

// Allowed status transitions, keyed by current status. The state machine is
// intentionally narrow:
//
//   accepted  → delivered  (seller posts the work / marks ready)
//   delivered → confirmed  (buyer acknowledges receipt — terminal)
//   accepted  → cancelled  (either party backs out before delivery)
//   delivered → disputed   (buyer refuses to confirm — opens a dispute)
//
// The 'requested' state from the legacy non-paid hire flow can also move
// to accepted (seller picks up the brief), delivered (seller skips ahead),
// or rejected/cancelled.
const TRANSITIONS: Record<string, string[]> = {
  requested: ['accepted', 'rejected', 'cancelled', 'delivered'],
  accepted:  ['delivered', 'cancelled'],
  delivered: ['confirmed', 'disputed'],
}

// Who is allowed to drive each transition.
function canTransition(from: string, to: string, role: 'buyer' | 'seller'): boolean {
  if (!TRANSITIONS[from]?.includes(to)) return false
  if (to === 'delivered' || to === 'rejected' || to === 'accepted') return role === 'seller'
  if (to === 'confirmed' || to === 'disputed') return role === 'buyer'
  if (to === 'cancelled') return true // either side can cancel before delivery
  return false
}

// PATCH /api/services/orders/[id] — body: { status, delivery_note? }
//
// Drives the service-order state machine. The buy route opens orders in
// 'accepted' (paid upfront) or 'requested' (legacy hire flow). From there:
//   • the seller marks the work delivered
//   • the buyer confirms receipt — terminal, completes the order
//   • either party can cancel before delivery; buyer can dispute after
//
// Notifies the counterparty (and fires their webhook) on every transition.
export async function PATCH(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { status?: string; delivery_note?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const next = body.status
  if (!next || !['accepted', 'delivered', 'confirmed', 'cancelled', 'rejected', 'disputed'].includes(next)) {
    return apiError('status must be one of: accepted, delivered, confirmed, cancelled, rejected, disputed')
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('service_orders')
    .select(`
      id, product_id, buyer_id, seller_id, status, brief, price_credits, delivery_note,
      product:products(id, title)
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!order) return apiError('Service order not found', 404)

  const role: 'buyer' | 'seller' | null =
    actor.actorId === order.buyer_id ? 'buyer' :
    actor.actorId === order.seller_id ? 'seller' : null
  if (!role) return apiError('Only the buyer or seller can update this order', 403)

  if (!canTransition(order.status, next, role)) {
    return apiError(`Cannot move order from ${order.status} to ${next} as ${role}`, 409)
  }

  const updates: Record<string, unknown> = {
    status: next,
    updated_at: new Date().toISOString(),
  }
  if (next === 'delivered') {
    updates.delivered_at = new Date().toISOString()
    if (body.delivery_note?.trim()) updates.delivery_note = body.delivery_note.trim()
  }
  if (next === 'confirmed') {
    updates.confirmed_at = new Date().toISOString()
  }

  const { data: updated, error } = await admin
    .from('service_orders')
    .update(updates)
    .eq('id', params.id)
    .select(`
      *,
      product:products(id, title, product_type, price_credits),
      buyer:profiles!buyer_id(id, username, display_name, avatar_url),
      seller:profiles!seller_id(id, username, display_name, avatar_url)
    `)
    .single()

  if (error) return apiError(error.message, 500)

  // Notify the counterparty + fire their webhook. The recipient is
  // whichever side did NOT drive this transition.
  const counterpartyId = role === 'seller' ? order.buyer_id : order.seller_id
  const productTitle = (order.product as { title?: string } | null)?.title ?? 'service'
  const orderShort = order.id.slice(0, 8)

  const titleByStatus: Record<string, string> = {
    accepted:  `Order #${orderShort} accepted`,
    delivered: `Order #${orderShort} delivered: "${productTitle}"`,
    confirmed: `Order #${orderShort} completed`,
    cancelled: `Order #${orderShort} cancelled`,
    rejected:  `Order #${orderShort} rejected`,
    disputed:  `Order #${orderShort} disputed`,
  }

  await createNotification({
    userId: counterpartyId,
    type:   `service_${next}`,
    title:  titleByStatus[next] ?? `Order #${orderShort} updated`,
    body:   next === 'delivered' && body.delivery_note?.trim()
      ? body.delivery_note.trim().slice(0, 200)
      : null,
    link:   '/dashboard?tab=services',
    event:  'service_request',
    data: {
      order_id:      order.id,
      product_id:    order.product_id,
      product_title: productTitle,
      status:        next,
      previous_status: order.status,
      driven_by:     role,
      price_credits: order.price_credits,
      delivery_note: (updates.delivery_note as string | undefined) ?? null,
    },
  })

  return apiSuccess({ order: updated })
}
