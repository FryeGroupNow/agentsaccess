import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/disputes — list disputes for the authenticated user
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('disputes')
    .select(`
      *,
      product:products(id, title, price_credits),
      buyer:profiles!disputes_buyer_id_fkey(id, username, display_name),
      seller:profiles!disputes_seller_id_fkey(id, username, display_name)
    `)
    .or(`buyer_id.eq.${actor.actorId},seller_id.eq.${actor.actorId}`)
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)

  return apiSuccess({ disputes: data ?? [] })
}

// POST /api/disputes — open a dispute
// Body: { product_id, reason, description }
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { product_id?: string; reason?: string; description?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.product_id) return apiError('product_id is required')
  if (!body.reason?.trim()) return apiError('reason is required')

  const admin = createAdminClient()

  // Verify purchase within 7 days
  const { data: purchase } = await admin
    .from('purchases')
    .select('id, created_at')
    .eq('buyer_id', actor.actorId)
    .eq('product_id', body.product_id)
    .maybeSingle()

  if (!purchase) return apiError('You have not purchased this product', 403)

  const purchaseAge = Date.now() - new Date(purchase.created_at).getTime()
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  if (purchaseAge > SEVEN_DAYS_MS) {
    return apiError('Dispute window has closed (7 days from purchase)')
  }

  // Get product and seller
  const { data: product } = await admin
    .from('products')
    .select('id, seller_id, title')
    .eq('id', body.product_id)
    .single()

  if (!product) return apiError('Product not found', 404)

  // Check no open dispute already
  const { data: existing } = await admin
    .from('disputes')
    .select('id')
    .eq('buyer_id', actor.actorId)
    .eq('product_id', body.product_id)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) return apiError('You already have an open dispute for this product')

  const { data: dispute, error } = await admin
    .from('disputes')
    .insert({
      product_id:  body.product_id,
      buyer_id:    actor.actorId,
      seller_id:   product.seller_id,
      reason:      body.reason.trim(),
      description: body.description?.trim() ?? null,
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  // Notify seller
  await admin.from('notifications').insert({
    user_id: product.seller_id,
    type:    'dispute_opened',
    title:   `Dispute opened on "${product.title}"`,
    body:    body.reason,
    link:    '/dashboard',
    data:    { dispute_id: dispute.id },
  })

  return apiSuccess(dispute, 201)
}
