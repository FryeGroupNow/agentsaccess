import { NextRequest } from 'next/server'
import { resolveActor, checkBotRestriction, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const productType = searchParams.get('type')
  const sort = searchParams.get('sort') ?? 'popular'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('products')
    .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type, avatar_url)')
    .eq('is_active', true)

  if (category) query = query.eq('category', category)
  if (productType && productType !== 'all') query = query.eq('product_type', productType)

  switch (sort) {
    case 'newest':     query = query.order('created_at',     { ascending: false }); break
    case 'rating':     query = query.order('average_rating', { ascending: false, nullsFirst: false }); break
    case 'price_asc':  query = query.order('price_credits',  { ascending: true }); break
    case 'price_desc': query = query.order('price_credits',  { ascending: false }); break
    case 'popular':
    default:           query = query.order('purchase_count', { ascending: false }); break
  }

  const { data, error } = await query.range(offset, offset + limit - 1)
  if (error) return apiError(error.message, 500)

  return apiSuccess({ products: data, limit, offset })
}

export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId: sellerId } = actor

  const restriction = await checkBotRestriction(sellerId, 'list_products')
  if (!restriction.ok) return apiError(restriction.error, restriction.status)

  let body: {
    title?: string
    tagline?: string | null
    description?: string
    price_credits?: number
    category?: string
    tags?: string[]
    is_digital_art?: boolean
    accept_starter_aa?: boolean
    file_url?: string | null
    file_name?: string | null
    file_size_bytes?: number | null
    cover_image_url?: string | null
    images?: string[]
    sections?: Record<string, string>
    product_type?: string
    pricing_type?: string
    subscription_period_days?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (!body.title) return apiError('title is required')
  if (!body.description) return apiError('description is required')
  if (body.pricing_type !== 'contact' && (!body.price_credits || body.price_credits <= 0)) {
    return apiError('price_credits must be positive')
  }
  if (!body.category) return apiError('category is required')

  const VALID_TYPES = ['digital_product','service','template','tool','api','dataset','digital_art']
  const VALID_PRICING = ['one_time','subscription','contact']
  const product_type = VALID_TYPES.includes(body.product_type ?? '') ? body.product_type : 'digital_product'
  const pricing_type = VALID_PRICING.includes(body.pricing_type ?? '') ? body.pricing_type : 'one_time'

  const admin = createAdminClient()
  const { data, error: insertError } = await admin
    .from('products')
    .insert({
      seller_id: sellerId,
      title: body.title,
      tagline: body.tagline ?? null,
      description: body.description,
      price_credits: body.price_credits ?? 0,
      category: body.category,
      tags: body.tags ?? [],
      is_digital_art: body.is_digital_art ?? product_type === 'digital_art',
      accept_starter_aa: body.accept_starter_aa ?? true,
      file_url: body.file_url ?? null,
      file_name: body.file_name ?? null,
      file_size_bytes: body.file_size_bytes ?? null,
      cover_image_url: body.cover_image_url ?? null,
      images: body.images ?? [],
      sections: body.sections ?? {},
      product_type,
      pricing_type,
      subscription_period_days: body.subscription_period_days ?? null,
      current_owner_id: sellerId,
    })
    .select()
    .single()

  if (insertError) return apiError(insertError.message, 500)

  return apiSuccess(data, 201)
}
