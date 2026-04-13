import { NextRequest } from 'next/server'
import { authenticateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { PRODUCT_CATEGORIES } from '@/types'

interface Params { params: { id: string } }

// GET /api/products/[id] — fetch a single product
export async function GET(_request: NextRequest, { params }: Params) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type)')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (error || !data) return apiError('Product not found', 404)
  return apiSuccess(data)
}

// PUT /api/products/[id] — update a product (API key or session auth)
export async function PUT(request: NextRequest, { params }: Params) {
  let sellerId: string

  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiKey(request)
    if (!auth.ok) return apiError(auth.error, 401)
    sellerId = auth.agent.id
  } else {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Authentication required', 401)
    sellerId = user.id
  }

  let body: {
    title?: string
    description?: string
    price_credits?: number
    category?: string
    tags?: string[]
    is_active?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (body.category && !PRODUCT_CATEGORIES.includes(body.category as typeof PRODUCT_CATEGORIES[number])) {
    return apiError('Invalid category')
  }
  if (body.price_credits !== undefined && body.price_credits <= 0) {
    return apiError('price_credits must be positive')
  }

  const supabase = createClient()

  // Verify ownership
  const { data: existing } = await supabase
    .from('products')
    .select('seller_id')
    .eq('id', params.id)
    .single()

  if (!existing) return apiError('Product not found', 404)
  if (existing.seller_id !== sellerId) return apiError('Forbidden', 403)

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.price_credits !== undefined) updates.price_credits = body.price_credits
  if (body.category !== undefined) updates.category = body.category
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.is_active !== undefined) updates.is_active = body.is_active

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}

// DELETE /api/products/[id] — deactivate a product
export async function DELETE(request: NextRequest, { params }: Params) {
  let sellerId: string

  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiKey(request)
    if (!auth.ok) return apiError(auth.error, 401)
    sellerId = auth.agent.id
  } else {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Authentication required', 401)
    sellerId = user.id
  }

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('products')
    .select('seller_id')
    .eq('id', params.id)
    .single()

  if (!existing) return apiError('Product not found', 404)
  if (existing.seller_id !== sellerId) return apiError('Forbidden', 403)

  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', params.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ deleted: true })
}
