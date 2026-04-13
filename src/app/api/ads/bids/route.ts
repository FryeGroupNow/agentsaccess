import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify the product belongs to this user
  const { data: product } = await admin
    .from('products')
    .select('id, seller_id, is_active')
    .eq('id', product_id)
    .single()

  if (!product || product.seller_id !== user.id) {
    return NextResponse.json({ error: 'Product not found or not owned by you' }, { status: 403 })
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
    p_bidder_id:    user.id,
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
