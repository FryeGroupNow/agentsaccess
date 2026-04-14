import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// GET /api/products/[id]/reviews
export async function GET(_req: NextRequest, { params }: Params) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('product_reviews')
    .select('*, reviewer:profiles!product_reviews_reviewer_id_fkey(id, username, display_name, user_type, avatar_url)')
    .eq('product_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)

  const reviews = data ?? []
  const humanReviews = reviews.filter((r) => r.reviewer_type === 'human')
  const botReviews   = reviews.filter((r) => r.reviewer_type === 'agent')

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null

  return apiSuccess({
    reviews,
    human_reviews: humanReviews,
    bot_reviews: botReviews,
    average_rating: avg ? Math.round(avg * 10) / 10 : null,
    review_count: reviews.length,
  })
}

// POST /api/products/[id]/reviews — submit review (must have purchased)
export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { rating?: number; review_text?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return apiError('rating must be between 1 and 5')
  }

  const admin = createAdminClient()

  // Verify purchase
  const { data: purchase } = await admin
    .from('purchases')
    .select('id')
    .eq('buyer_id', actor.actorId)
    .eq('product_id', params.id)
    .maybeSingle()

  if (!purchase) return apiError('You must purchase this product before reviewing', 403)

  // Get reviewer type
  const { data: reviewer } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', actor.actorId)
    .single()

  const { data: review, error } = await admin
    .from('product_reviews')
    .insert({
      product_id:     params.id,
      reviewer_id:    actor.actorId,
      rating:         body.rating,
      review_text:    body.review_text?.trim() ?? null,
      reviewer_type:  reviewer?.user_type ?? 'human',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return apiError('You have already reviewed this product')
    return apiError(error.message, 500)
  }

  // Notify seller
  const { data: product } = await admin
    .from('products')
    .select('seller_id, title')
    .eq('id', params.id)
    .single()

  if (product) {
    await admin.from('notifications').insert({
      user_id: product.seller_id,
      type:    'review',
      title:   `New ${body.rating}★ review on "${product.title}"`,
      body:    body.review_text?.slice(0, 100) ?? null,
      link:    `/marketplace/${params.id}`,
      data:    { rating: body.rating },
    })
  }

  return apiSuccess(review, 201)
}

// PATCH /api/products/[id]/reviews — seller adds response
// Body: { review_id: string, seller_response: string }
export async function PATCH(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { review_id?: string; seller_response?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.review_id) return apiError('review_id is required')
  if (!body.seller_response?.trim()) return apiError('seller_response is required')

  const admin = createAdminClient()

  // Verify the actor is the product seller
  const { data: product } = await admin
    .from('products')
    .select('seller_id')
    .eq('id', params.id)
    .single()

  if (!product || product.seller_id !== actor.actorId) {
    return apiError('Only the seller can respond to reviews', 403)
  }

  const { data, error } = await admin
    .from('product_reviews')
    .update({ seller_response: body.seller_response.trim() })
    .eq('id', body.review_id)
    .eq('product_id', params.id)
    .select()
    .single()

  if (error || !data) return apiError('Review not found or update failed', 404)

  return apiSuccess(data)
}
