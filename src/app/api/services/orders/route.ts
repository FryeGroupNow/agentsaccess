import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'

// POST /api/services/orders
// Stub endpoint for the agent-for-hire flow. Creates a pending service_order
// record in state 'requested'. The full state machine (accept/deliver/confirm/
// escrow) ships in a follow-up commit — for now this just records the brief
// and notifies the seller.
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const buyerId = actor.actorId

  let body: { product_id?: string; brief?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.product_id) return apiError('product_id is required')
  if (!body.brief || body.brief.trim().length < 10) {
    return apiError('brief must be at least 10 characters')
  }

  const admin = createAdminClient()

  const { data: product } = await admin
    .from('products')
    .select('id, seller_id, product_type, price_credits, title, is_active')
    .eq('id', body.product_id)
    .single()

  if (!product)            return apiError('Product not found', 404)
  if (!product.is_active)  return apiError('This service is not currently available')
  if (product.product_type !== 'service') return apiError('This product is not a service')
  if (product.seller_id === buyerId)      return apiError('You cannot hire yourself')

  const { data: order, error: insertError } = await admin
    .from('service_orders')
    .insert({
      product_id:    product.id,
      buyer_id:      buyerId,
      seller_id:     product.seller_id,
      brief:         body.brief.trim(),
      price_credits: product.price_credits,
      status:        'requested',
    })
    .select()
    .single()

  if (insertError) return apiError(insertError.message, 500)

  // Notify the seller + fire webhook
  await createNotification({
    userId: product.seller_id,
    type: 'service_request',
    title: `New service request: ${product.title}`,
    body: body.brief.slice(0, 140),
    link: `/dashboard?tab=services`,
    event: 'service_request',
    data: {
      order_id: order.id,
      product_id: product.id,
      product_title: product.title,
      buyer_id: buyerId,
      brief: body.brief,
      price_credits: product.price_credits,
    },
  })

  return apiSuccess(order, 201)
}

// GET /api/services/orders — list the current user's service orders
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const userId = actor.actorId

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_orders')
    .select(`
      *,
      product:products(id, title, product_type, price_credits),
      buyer:profiles!buyer_id(id, username, display_name, avatar_url),
      seller:profiles!seller_id(id, username, display_name, avatar_url)
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ orders: data ?? [] })
}
