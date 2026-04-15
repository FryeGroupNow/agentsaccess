import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { authenticateApiKey } from '@/lib/api-auth'
import type { SlotState } from '@/types'

// GET /api/ads/slots
//
// Returns the current state of all 6 ad slots, including:
//   - the live placement (if any) for the current hour
//   - the top bid + bidder count for the next hour's auction
//   - seconds until that auction settles
//   - if the caller is authenticated, their own bid amount and
//     winning/outbid status for each slot's next-period auction
//
// Auth is OPTIONAL. Anonymous callers see all the public fields but
// my_bid_amount / my_bid_status come back null. Both session cookies
// and Bearer API keys work.
//
// As a side effect this route lazily settles the auctions for the
// current period — that's how next-period bids become live ads when
// no instant-ad path is used.
export async function GET(request: NextRequest) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── Optional auth (works with cookie OR Bearer key) ───────────────────
  let actorId: string | null = null
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiKey(request)
    if (auth.ok) actorId = auth.agent.id
  } else {
    try {
      const supabase = createServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      actorId = user?.id ?? null
    } catch {
      actorId = null
    }
  }

  const now = new Date()
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

  // Current placements with full product data
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

  // Next-period bid summaries (top bid + count)
  const { data: nextBids } = await admin
    .from('ad_bids')
    .select('slot_id, amount_credits')
    .in('slot_id', [1, 2, 3, 4, 5, 6])
    .eq('period_start', nextPeriod.toISOString())
    .eq('status', 'pending')

  // The caller's own pending bids for next period (if authenticated)
  const myBids = new Map<number, number>()
  if (actorId) {
    const { data: mine } = await admin
      .from('ad_bids')
      .select('slot_id, amount_credits')
      .eq('bidder_id', actorId)
      .eq('period_start', nextPeriod.toISOString())
      .eq('status', 'pending')

    for (const b of mine ?? []) {
      const existing = myBids.get(b.slot_id) ?? 0
      if (b.amount_credits > existing) myBids.set(b.slot_id, b.amount_credits)
    }
  }

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

  const secondsUntilSettle = Math.max(0, Math.floor((nextPeriod.getTime() - now.getTime()) / 1000))

  const slots: SlotState[] = SLOT_DEFS.map(({ id, side, position }) => {
    const placement = (placementBySlot.get(id) ?? null) as SlotState['current_placement']
    const topBid = nextBidsBySlot.get(id)?.top ?? 0
    const myBid = myBids.get(id) ?? null
    const myStatus: SlotState['my_bid_status'] =
      myBid == null ? null : myBid >= topBid ? 'winning' : 'outbid'

    return {
      slot_id: id,
      side,
      position,
      current_placement: placement,
      current_winning_bid: placement?.winning_bid_credits ?? 0,
      next_period_start: nextPeriod.toISOString(),
      next_period_top_bid: topBid,
      next_period_bid_count: nextBidsBySlot.get(id)?.count ?? 0,
      seconds_until_settle: secondsUntilSettle,
      my_bid_amount: myBid,
      my_bid_status: myStatus,
    }
  })

  return NextResponse.json({
    slots,
    server_time: now.toISOString(),
    current_period_start: currentPeriod.toISOString(),
    next_period_start: nextPeriod.toISOString(),
  })
}
