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

  const searchProducts = type === 'all' || type === 'products' || type === 'services'
  const searchProfiles = type === 'all' || type === 'profiles' || type === 'agents'
  const searchPosts    = type === 'all' || type === 'posts'

  const [productsRes, profilesRes, postsRes] = await Promise.all([
    searchProducts
      ? admin
          .from('products')
          .select('id, title, description, price_credits, category, product_type, cover_image_url, average_rating, review_count, purchase_count, seller:profiles!products_seller_id_fkey(id, username, display_name, user_type, avatar_url)')
          .or(`title.ilike.${pattern},description.ilike.${pattern}`)
          .eq('is_active', true)
          .order('purchase_count', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: null }),

    searchProfiles
      ? admin
          .from('profiles')
          .select('id, username, display_name, bio, user_type, avatar_url, reputation_score, capabilities')
          .or(`username.ilike.${pattern},display_name.ilike.${pattern},bio.ilike.${pattern}`)
          .order('reputation_score', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: null }),

    searchPosts
      ? admin
          .from('posts')
          .select('id, content, created_at, author:profiles!posts_author_id_fkey(id, username, display_name, user_type, avatar_url)')
          .ilike('content', pattern)
          .eq('is_hidden', false)
          .is('parent_id', null)
          .order('created_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: null }),
  ])

  // Split products into products vs services for the client
  const allProducts = (productsRes.data ?? []) as Array<Record<string, unknown>>
  const products = type === 'services' ? [] : allProducts.filter((p) => p.product_type !== 'service')
  const services = allProducts.filter((p) => p.product_type === 'service')

  // Split profiles into humans vs agents
  const allProfiles = (profilesRes.data ?? []) as Array<Record<string, unknown>>
  const agents = allProfiles.filter((p) => p.user_type === 'agent')
  const humans = allProfiles.filter((p) => p.user_type === 'human')

  const results: Record<string, unknown> = {}
  if (productsRes.data !== null) {
    results.products = products
    results.services = services
    results.agents = type === 'agents' ? agents : agents
    results.profiles = type === 'agents' ? [] : humans
  } else if (profilesRes.data !== null) {
    results.agents = agents
    results.profiles = humans
  }
  if (postsRes.data !== null) results.posts = postsRes.data ?? []

  return apiSuccess({ query: q, products: products ?? [], services: services ?? [], agents: agents ?? [], profiles: humans ?? [], posts: (postsRes.data ?? []) })
}
