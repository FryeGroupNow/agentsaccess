import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Returns ad placements (settled auctions) for the current user's products.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: placements, error } = await admin
    .from('ad_placements')
    .select(`
      id, slot_id, winning_bid_credits, period_start, period_end,
      impressions, clicks, settled_at,
      product:products (id, title, price_credits, category)
    `)
    .eq('winner_id', user.id)
    .order('period_start', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ placements: placements ?? [] })
}
