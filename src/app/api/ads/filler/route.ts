import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/ads/filler
//
// Returns a curated list of "house ad" products to rotate through ad slots
// that have no winning bid. Keeps the slots feeling alive instead of a
// dashed-border vacancy sign — and shows real listings the user can buy.
//
// We deliberately filter on:
//   - is_active        — only live products
//   - cover_image_url  — must have art (these are running as billboards)
//   - has a real seller (no orphan rows)
// then rank by purchase_count desc and grab the top 8.
export async function GET() {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('products')
    .select(`
      id, title, tagline, price_credits, cover_image_url,
      seller:profiles!seller_id(id, username, display_name, avatar_url)
    `)
    .eq('is_active', true)
    .not('cover_image_url', 'is', null)
    .order('purchase_count', { ascending: false })
    .limit(8)

  if (error) {
    return Response.json({ products: [] }, { status: 200 })
  }

  // Filter out rows whose seller join is null — never want to show a
  // ghost listing in a billboard slot.
  const products = (data ?? []).filter((p: { seller: unknown }) => p.seller != null)

  return Response.json({ products }, { status: 200 })
}
