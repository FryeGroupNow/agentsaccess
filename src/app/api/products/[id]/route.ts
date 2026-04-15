import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PRODUCT_CATEGORIES } from '@/types'

interface Params { params: { id: string } }

// GET /api/products/[id] — fetch a single product (public, no auth required)
export async function GET(_request: NextRequest, { params }: Params) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type)')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (error || !data) return apiError('Product not found', 404)
  return apiSuccess(data)
}

const VALID_PRODUCT_TYPES = ['digital_product', 'service', 'template', 'tool', 'api', 'dataset', 'digital_art'] as const
const VALID_PRICING_TYPES = ['one_time', 'subscription', 'contact'] as const

interface ProductUpdateBody {
  title?: string
  tagline?: string | null
  description?: string
  price_credits?: number
  category?: string
  tags?: string[]
  is_active?: boolean
  cover_image_url?: string | null
  images?: string[]
  sections?: Record<string, string>
  product_type?: string
  pricing_type?: string
  subscription_period_days?: number | null
  accept_starter_aa?: boolean
}

async function handleUpdate(request: NextRequest, productId: string) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  let body: ProductUpdateBody
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (body.category && !PRODUCT_CATEGORIES.includes(body.category as typeof PRODUCT_CATEGORIES[number])) {
    return apiError('Invalid category')
  }
  if (body.price_credits !== undefined && body.price_credits < 0) {
    return apiError('price_credits must be >= 0')
  }
  if (body.product_type !== undefined &&
      !VALID_PRODUCT_TYPES.includes(body.product_type as typeof VALID_PRODUCT_TYPES[number])) {
    return apiError('Invalid product_type')
  }
  if (body.pricing_type !== undefined &&
      !VALID_PRICING_TYPES.includes(body.pricing_type as typeof VALID_PRICING_TYPES[number])) {
    return apiError('Invalid pricing_type')
  }

  const admin = createAdminClient()

  // Ownership: actor can update if they are the direct seller, or if the
  // seller is an agent they own (humans managing their bots' listings).
  const { data: existing } = await admin
    .from('products')
    .select('id, seller_id, seller:profiles!seller_id(id, owner_id, user_type)')
    .eq('id', productId)
    .single()

  if (!existing) return apiError('Product not found', 404)

  const seller = existing.seller as unknown as { id: string; owner_id: string | null; user_type: string } | null
  const isDirectOwner = existing.seller_id === actorId
  const isOwnedBot = seller?.user_type === 'agent' && seller?.owner_id === actorId
  if (!isDirectOwner && !isOwnedBot) {
    return apiError('Forbidden — you do not own this product', 403)
  }

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined)                   updates.title = body.title
  if (body.tagline !== undefined)                 updates.tagline = body.tagline
  if (body.description !== undefined)             updates.description = body.description
  if (body.price_credits !== undefined)           updates.price_credits = body.price_credits
  if (body.category !== undefined)                updates.category = body.category
  if (body.tags !== undefined)                    updates.tags = body.tags
  if (body.is_active !== undefined)               updates.is_active = body.is_active
  if (body.cover_image_url !== undefined)         updates.cover_image_url = body.cover_image_url
  if (body.images !== undefined)                  updates.images = body.images
  if (body.sections !== undefined)                updates.sections = body.sections
  if (body.product_type !== undefined)            updates.product_type = body.product_type
  if (body.pricing_type !== undefined)            updates.pricing_type = body.pricing_type
  if (body.subscription_period_days !== undefined) updates.subscription_period_days = body.subscription_period_days
  if (body.accept_starter_aa !== undefined)       updates.accept_starter_aa = body.accept_starter_aa

  if (Object.keys(updates).length === 0) {
    return apiError('No fields to update')
  }

  const { data, error } = await admin
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type, avatar_url)')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}

// PUT and PATCH behave identically — both accept partial updates. PATCH
// matches REST convention; PUT is kept for backwards compatibility with
// existing clients (the edit modal already uses PUT).
export async function PUT(request: NextRequest, { params }: Params) {
  return handleUpdate(request, params.id)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleUpdate(request, params.id)
}

// DELETE /api/products/[id] — deactivate a product
export async function DELETE(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('products')
    .select('seller_id, seller:profiles!seller_id(id, owner_id, user_type)')
    .eq('id', params.id)
    .single()

  if (!existing) return apiError('Product not found', 404)

  const seller = existing.seller as unknown as { id: string; owner_id: string | null; user_type: string } | null
  const isDirectOwner = existing.seller_id === actorId
  const isOwnedBot = seller?.user_type === 'agent' && seller?.owner_id === actorId
  if (!isDirectOwner && !isOwnedBot) return apiError('Forbidden', 403)

  const { error } = await admin
    .from('products')
    .update({ is_active: false })
    .eq('id', params.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ deleted: true })
}
