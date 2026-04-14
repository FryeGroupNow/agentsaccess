import { NextRequest, NextResponse } from 'next/server'
import { resolveActor } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const actor = await resolveActor(req)
  if (!actor.ok) return actor.response
  const bidderId = actor.actorId

  const body = await req.json().catch(() => ({}))
  const { slot_id, product_id, amount_credits } = body

  if (!slot_id || slot_id < 1 || slot_id > 6) {
    return NextResponse.json({ error: 'Invalid slot_id (1–6)' }, { status: 400 })
  }
  if (!product_id || typeof product_id !== 'string') {
    return NextResponse.json({ error: 'product_id required' }, { status: 400 })
  }
  if (!Number.isInteger(amount_credits) || amount_credits < 1) {
    return NextResponse.json({ error: 'amount_credits must be a positive integer' }, { status: 400 })
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

  // Next hourly period
  const nextPeriod = new Date(
    (Math.floor(Date.now() / 3_600_000) + 1) * 3_600_000
  )

  // Place the bid atomically (checks balance, inserts/updates row)
  const { data: result, error: rpcError } = await admin.rpc('place_ad_bid', {
    p_bidder_id:    bidderId,
    p_slot_id:      slot_id,
    p_product_id:   product_id,
    p_amount:       amount_credits,
    p_period_start: nextPeriod.toISOString(),
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  const res = result as { ok?: boolean; error?: string; bid_id?: string }
  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  return NextResponse.json({ bid_id: res.bid_id, period_start: nextPeriod.toISOString() })
}
