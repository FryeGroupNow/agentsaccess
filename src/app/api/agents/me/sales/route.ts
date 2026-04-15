import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiSuccess } from '@/lib/api-auth'

// GET /api/agents/me/sales
//
// Returns the caller's sales + purchases across every marketplace surface:
// product purchases, service orders, bot rentals, and sponsorship agreements.
// Each row is normalised into a unified shape with a `direction` field
// ('in' = credits received, 'out' = credits spent) so callers don't have to
// parse four schemas.
//
// Query params:
//   limit    (default 50, max 200)
//   offset   (default 0)
//   kind     (optional: 'product' | 'service' | 'rental' | 'sponsorship')
//   direction (optional: 'in' | 'out')
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId } = actor

  const { searchParams } = new URL(request.url)
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50'), 200)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0)
  const kind   = searchParams.get('kind')
  const direction = searchParams.get('direction')

  const admin = createAdminClient()

  type SaleItem = {
    id: string
    kind: 'product' | 'service' | 'rental' | 'sponsorship'
    direction: 'in' | 'out'
    counterparty_id: string | null
    amount_credits: number
    status: string | null
    title: string | null
    created_at: string
  }

  const out: SaleItem[] = []

  // ── Product purchases (buyer or seller) ─────────────────────────────
  //
  // Supabase can't filter on a joined table inside .or(), so we run two
  // queries: one for "I bought this" and one for "someone bought mine".
  if (!kind || kind === 'product') {
    const [boughtRes, soldRes] = await Promise.all([
      admin
        .from('purchases')
        .select('id, buyer_id, created_at, product:products!purchases_product_id_fkey(id, title, price_credits, seller_id)')
        .eq('buyer_id', actorId)
        .order('created_at', { ascending: false })
        .limit(250),
      admin
        .from('purchases')
        .select('id, buyer_id, created_at, product:products!purchases_product_id_fkey!inner(id, title, price_credits, seller_id)')
        .eq('product.seller_id', actorId)
        .order('created_at', { ascending: false })
        .limit(250),
    ])

    type PurchaseRow = {
      id: string
      buyer_id: string
      created_at: string
      product: { id: string; title: string; price_credits: number; seller_id: string } | { id: string; title: string; price_credits: number; seller_id: string }[] | null
    }

    const pickProduct = (p: PurchaseRow['product']) =>
      Array.isArray(p) ? (p[0] ?? null) : p

    for (const p of (boughtRes.data ?? []) as unknown as PurchaseRow[]) {
      const prod = pickProduct(p.product)
      if (!prod) continue
      out.push({
        id: p.id,
        kind: 'product',
        direction: 'out',
        counterparty_id: prod.seller_id,
        amount_credits: prod.price_credits,
        status: 'completed',
        title: prod.title,
        created_at: p.created_at,
      })
    }

    for (const p of (soldRes.data ?? []) as unknown as PurchaseRow[]) {
      const prod = pickProduct(p.product)
      if (!prod) continue
      out.push({
        id: p.id,
        kind: 'product',
        direction: 'in',
        counterparty_id: p.buyer_id,
        amount_credits: prod.price_credits,
        status: 'completed',
        title: prod.title,
        created_at: p.created_at,
      })
    }
  }

  // ── Service orders (hire flow) ──────────────────────────────────────
  if (!kind || kind === 'service') {
    const { data: orders } = await admin
      .from('service_orders')
      .select(`
        id, buyer_id, seller_id, brief, price_credits, status, created_at,
        product:products!service_orders_product_id_fkey(id, title)
      `)
      .or(`buyer_id.eq.${actorId},seller_id.eq.${actorId}`)
      .order('created_at', { ascending: false })
      .limit(200)

    type OrderRow = {
      id: string
      buyer_id: string
      seller_id: string
      brief: string
      price_credits: number
      status: string
      created_at: string
      product: { id: string; title: string } | { id: string; title: string }[] | null
    }

    for (const o of (orders ?? []) as unknown as OrderRow[]) {
      const prod = Array.isArray(o.product) ? (o.product[0] ?? null) : o.product
      const isSeller = o.seller_id === actorId
      out.push({
        id: o.id,
        kind: 'service',
        direction: isSeller ? 'in' : 'out',
        counterparty_id: isSeller ? o.buyer_id : o.seller_id,
        amount_credits: o.price_credits,
        status: o.status,
        title: prod?.title ?? (o.brief.length > 60 ? o.brief.slice(0, 60) + '…' : o.brief),
        created_at: o.created_at,
      })
    }
  }

  // ── Bot rentals ─────────────────────────────────────────────────────
  if (!kind || kind === 'rental') {
    const { data: rentals } = await admin
      .from('bot_rentals')
      .select('id, bot_id, owner_id, renter_id, daily_rate_aa, status, started_at')
      .or(`owner_id.eq.${actorId},renter_id.eq.${actorId},bot_id.eq.${actorId}`)
      .order('started_at', { ascending: false })
      .limit(200)

    for (const r of rentals ?? []) {
      // Owner receives, renter pays; bot itself is neither — skip unless also owner/renter.
      const isOwner = r.owner_id === actorId
      const isRenter = r.renter_id === actorId
      if (!isOwner && !isRenter) continue
      out.push({
        id: r.id,
        kind: 'rental',
        direction: isOwner ? 'in' : 'out',
        counterparty_id: isOwner ? r.renter_id : r.owner_id,
        amount_credits: r.daily_rate_aa,
        status: r.status,
        title: `Bot rental (${r.daily_rate_aa} AA/day)`,
        created_at: r.started_at,
      })
    }
  }

  // ── Sponsorships ────────────────────────────────────────────────────
  //
  // sponsor_agreements holds the terms, not the funding ledger. We still
  // surface the agreement (handy for "who's sponsoring me?") and use the
  // transactions ledger to sum the actual credits moved under that agreement.
  if (!kind || kind === 'sponsorship') {
    const { data: sponsors } = await admin
      .from('sponsor_agreements')
      .select('id, bot_id, sponsor_id, daily_limit_aa, revenue_split_sponsor_pct, status, created_at')
      .or(`bot_id.eq.${actorId},sponsor_id.eq.${actorId}`)
      .order('created_at', { ascending: false })
      .limit(200)

    for (const s of (sponsors ?? []) as Array<{
      id: string
      bot_id: string
      sponsor_id: string
      daily_limit_aa: number
      revenue_split_sponsor_pct: number
      status: string
      created_at: string
    }>) {
      const isBot = s.bot_id === actorId
      out.push({
        id: s.id,
        kind: 'sponsorship',
        direction: isBot ? 'in' : 'out',
        counterparty_id: isBot ? s.sponsor_id : s.bot_id,
        amount_credits: s.daily_limit_aa,
        status: s.status,
        title: `Sponsorship (${s.daily_limit_aa} AA/day, ${s.revenue_split_sponsor_pct}% split)`,
        created_at: s.created_at,
      })
    }
  }

  // Filter by direction if requested
  let filtered = direction === 'in' || direction === 'out'
    ? out.filter((s) => s.direction === direction)
    : out

  filtered = filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const total_in  = filtered.filter((s) => s.direction === 'in').reduce((sum, s) => sum + s.amount_credits, 0)
  const total_out = filtered.filter((s) => s.direction === 'out').reduce((sum, s) => sum + s.amount_credits, 0)

  return apiSuccess({
    sales: filtered.slice(offset, offset + limit),
    total: filtered.length,
    totals: {
      total_in_credits: total_in,
      total_out_credits: total_out,
      net_credits: total_in - total_out,
    },
    limit,
    offset,
  })
}
