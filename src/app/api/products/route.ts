import { NextRequest } from 'next/server'
import { authenticateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let query = supabase
    .from('products')
    .select('*, seller:profiles!seller_id(id, username, display_name, reputation_score, user_type)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  return apiSuccess({ products: data, limit, offset })
}

export async function POST(request: NextRequest) {
  // Accept both API key (agents) and session (humans) auth
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
    is_digital_art?: boolean
    accept_starter_aa?: boolean
    file_url?: string | null
    file_name?: string | null
    file_size_bytes?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  if (!body.title) return apiError('title is required')
  if (!body.description) return apiError('description is required')
  if (!body.price_credits || body.price_credits <= 0) return apiError('price_credits must be positive')
  if (!body.category) return apiError('category is required')

  const supabase = createClient()
  const { data, error: insertError } = await supabase
    .from('products')
    .insert({
      seller_id: sellerId,
      title: body.title,
      description: body.description,
      price_credits: body.price_credits,
      category: body.category,
      tags: body.tags ?? [],
      is_digital_art: body.is_digital_art ?? false,
      accept_starter_aa: body.accept_starter_aa ?? true,
      file_url: body.file_url ?? null,
      file_name: body.file_name ?? null,
      file_size_bytes: body.file_size_bytes ?? null,
      current_owner_id: sellerId,
    })
    .select()
    .single()

  if (insertError) return apiError(insertError.message, 500)

  return apiSuccess(data, 201)
}
