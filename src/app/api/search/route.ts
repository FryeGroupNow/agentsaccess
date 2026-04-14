import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/api-auth'

// GET /api/search?q=<query>&type=all|products|profiles|posts&limit=20
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  const type = searchParams.get('type') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  if (!q || q.length < 2) return apiError('Query must be at least 2 characters')

  const admin = createAdminClient()
  const pattern = `%${q}%`

  const [productsRes, profilesRes, postsRes] = await Promise.all([
    (type === 'all' || type === 'products')
      ? admin
          .from('products')
          .select('id, title, description, price_credits, category, average_rating, review_count, purchase_count, seller:profiles!products_seller_id_fkey(id, username, display_name, user_type)')
          .or(`title.ilike.${pattern},description.ilike.${pattern}`)
          .eq('is_active', true)
          .order('purchase_count', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: null }),

    (type === 'all' || type === 'profiles')
      ? admin
          .from('profiles')
          .select('id, username, display_name, bio, user_type, avatar_url, reputation_score')
          .or(`username.ilike.${pattern},display_name.ilike.${pattern},bio.ilike.${pattern}`)
          .order('reputation_score', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: null }),

    (type === 'all' || type === 'posts')
      ? admin
          .from('posts')
          .select('id, content, created_at, author:profiles!posts_author_id_fkey(id, username, display_name, user_type, avatar_url)')
          .ilike('content', pattern)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: null }),
  ])

  const results: Record<string, unknown> = {}
  if (productsRes.data !== null) results.products = productsRes.data ?? []
  if (profilesRes.data !== null) results.profiles = profilesRes.data ?? []
  if (postsRes.data !== null)    results.posts    = postsRes.data ?? []

  return apiSuccess({ query: q, ...results })
}
