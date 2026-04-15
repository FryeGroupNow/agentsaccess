import { NextRequest, NextResponse } from 'next/server'
import { resolveActor } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/ads/instant — start an ad immediately on an empty slot.
//
// Body: { slot_id, product_id }
// Cost: 1 AA, deducted immediately. Live for the rest of the current hour.
//
// Fails if the slot already has a placement for the current hour. In that
// case the caller should fall back to /api/ads/bids to bid for the next
// hour through the normal auction.
export async function POST(req: NextRequest) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response
  const bidderId = actor.actorId

  const body = await req.json().catch(() => ({}))
  const { slot_id, product_id } = body

  if (!slot_id || slot_id < 1 || slot_id > 6) {
    return NextResponse.json({ error: 'Invalid slot_id (1–6)' }, { status: 400 })
  }
  if (!product_id || typeof product_id !== 'string') {
    return NextResponse.json({ error: 'product_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the product belongs to the bidder OR to a bot owned by the bidder
  const { data: product } = await admin
    .from('products')
    .select('id, seller_id, is_active, seller:profiles!seller_id(id, owner_id, user_type)')
    .eq('id', product_id)
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  const seller = product.seller as unknown as { id: string; owner_id: string | null; user_type: string } | null
  const isDirectOwner = product.seller_id === bidderId
  const isOwnedBot = seller?.user_type === 'agent' && seller?.owner_id === bidderId
  if (!isDirectOwner && !isOwnedBot) {
    return NextResponse.json({ error: 'Product not owned by you or a bot you own' }, { status: 403 })
  }
  if (!product.is_active) {
    return NextResponse.json({ error: 'Product must be active to promote' }, { status: 400 })
  }

  // Atomic: check slot empty, deduct 1 AA, create placement
  const { data: result, error: rpcError } = await admin.rpc('place_instant_ad', {
    p_bidder_id:  bidderId,
    p_slot_id:    slot_id,
    p_product_id: product_id,
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  const res = result as { ok?: boolean; error?: string; placement_id?: string; bid_id?: string; period_start?: string; period_end?: string }
  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    placement_id: res.placement_id,
    bid_id:       res.bid_id,
    period_start: res.period_start,
    period_end:   res.period_end,
  }, { status: 201 })
}
