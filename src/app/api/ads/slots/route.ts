import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { SlotState } from '@/types'

// Returns current state of all 6 ad slots.
// Lazily settles auctions for the current period on each request.
export async function GET() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  // Truncate to current hour in UTC
  const currentPeriod = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000)
  const nextPeriod    = new Date(currentPeriod.getTime() + 3_600_000)

  // Lazily settle auctions for the current period across all slots
  await Promise.all(
    [1, 2, 3, 4, 5, 6].map((slot_id) =>
      admin.rpc('settle_ad_auction', {
        p_slot_id: slot_id,
        p_period_start: currentPeriod.toISOString(),
      })
    )
  )

  // Fetch current placements with product data
  const { data: placements } = await admin
    .from('ad_placements')
    .select(`
      *,
      product:products (
        id, title, tagline, description, price_credits, category, seller_id,
        cover_image_url, images, product_type, pricing_type,
        is_active, purchase_count, tags, file_url, file_name,
        is_digital_art, current_owner_id, created_at, updated_at,
        seller:profiles!seller_id (
          id, username, display_name, avatar_url, reputation_score, user_type
        )
      )
    `)
    .in('slot_id', [1, 2, 3, 4, 5, 6])
    .eq('period_start', currentPeriod.toISOString())

  // Fetch next-period bid summaries
  const { data: nextBids } = await admin
    .from('ad_bids')
    .select('slot_id, amount_credits')
    .in('slot_id', [1, 2, 3, 4, 5, 6])
    .eq('period_start', nextPeriod.toISOString())
    .eq('status', 'pending')

  // Build per-slot lookup
  const placementBySlot = new Map(
    (placements ?? []).map((p) => [p.slot_id as number, p])
  )

  const nextBidsBySlot = new Map<number, { top: number; count: number }>()
  for (const b of nextBids ?? []) {
    const slot = b.slot_id as number
    const existing = nextBidsBySlot.get(slot) ?? { top: 0, count: 0 }
    nextBidsBySlot.set(slot, {
      top: Math.max(existing.top, b.amount_credits as number),
      count: existing.count + 1,
    })
  }

  const SLOT_DEFS: Array<{ id: number; side: 'left' | 'right'; position: number }> = [
    { id: 1, side: 'left',  position: 1 },
    { id: 2, side: 'left',  position: 2 },
    { id: 3, side: 'left',  position: 3 },
    { id: 4, side: 'right', position: 1 },
    { id: 5, side: 'right', position: 2 },
    { id: 6, side: 'right', position: 3 },
  ]

  const slots: SlotState[] = SLOT_DEFS.map(({ id, side, position }) => ({
    slot_id: id,
    side,
    position,
    current_placement: (placementBySlot.get(id) ?? null) as SlotState['current_placement'],
    next_period_start: nextPeriod.toISOString(),
    next_period_top_bid: nextBidsBySlot.get(id)?.top ?? 0,
    next_period_bid_count: nextBidsBySlot.get(id)?.count ?? 0,
  }))

  return NextResponse.json({ slots })
}
