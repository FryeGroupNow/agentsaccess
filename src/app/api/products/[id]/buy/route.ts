import { NextRequest } from 'next/server'
import { resolveActor, checkBotRestriction, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notify'
import { calcAAFees } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const { actorId: buyerId } = actor

  const restriction = await checkBotRestriction(buyerId, 'buy_products')
  if (!restriction.ok) return apiError(restriction.error, restriction.status)

  const admin = createAdminClient()
  // Alias for clarity — all DB ops go through admin to support API-key auth
  const supabase = admin

  // Fetch the product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, seller_id, price_credits, title, product_type, is_active, is_digital_art, file_url, file_name, accept_starter_aa')
    .eq('id', params.id)
    .single()

  if (productError || !product) return apiError('Product not found', 404)
  if (!product.is_active) return apiError('Product is no longer available')
  if (product.seller_id === buyerId) return apiError('Cannot buy your own product')

  // Check not already purchased
  const { data: existing } = await supabase
    .from('purchases')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('product_id', params.id)
    .single()

  if (existing) return apiError('Already purchased')

  // Calculate fees
  const { buyer_fee, seller_fee, you_pay } = calcAAFees(product.price_credits)

  // Enforce accept_starter_aa restriction
  if (!product.accept_starter_aa) {
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('credit_balance, bonus_balance')
      .eq('id', buyerId)
      .single()

    const redeemable = (buyerProfile?.credit_balance ?? 0) - (buyerProfile?.bonus_balance ?? 0)
    if (redeemable < you_pay) {
      return apiError(
        `This listing requires Redeemable AA only. You have ${Math.max(0, redeemable)} Redeemable AA but need ${you_pay} AA (including 2.5% fee).`,
        402
      )
    }
  }

  // Transfer credits buyer → seller (with fees applied in DB function)
  const { data: txId, error: txError } = await supabase.rpc('transfer_credits', {
    p_from_id:    buyerId,
    p_to_id:      product.seller_id,
    p_amount:     product.price_credits,
    p_type:       'buy_product',
    p_product_id: product.id,
    p_notes:      `Purchase: ${product.title}`,
    p_buyer_fee:  buyer_fee,
    p_seller_fee: seller_fee,
  })

  if (txError) return apiError(txError.message, 500)

  // Record the purchase
  await supabase.from('purchases').insert({
    buyer_id:       buyerId,
    product_id:     product.id,
    transaction_id: txId,
  })

  // Increment purchase count. Billy reported seller dashboards still
  // showing 0 sales after buys, which means the previous fire-and-forget
  // RPC call was failing silently in the live DB. Try the RPC first, fall
  // back to a read-then-write so the counter always lands. Both paths log
  // but neither fails the whole buy — credits already moved and the
  // counter is a denormalised stat.
  const { error: rpcErr } = await supabase.rpc('increment_purchase_count', { p_product_id: product.id })
  if (rpcErr) {
    console.error('[buy] increment_purchase_count RPC failed, using fallback:', rpcErr.message)
    const { data: current } = await supabase
      .from('products')
      .select('purchase_count')
      .eq('id', product.id)
      .single()
    const next = (current?.purchase_count ?? 0) + 1
    const { error: updateErr } = await supabase
      .from('products')
      .update({ purchase_count: next })
      .eq('id', product.id)
    if (updateErr) console.error('[buy] purchase_count fallback update failed:', updateErr.message)
  }

  // Digital art: transfer ownership and retire listing (one owner at a time)
  if (product.is_digital_art) {
    await supabase
      .from('products')
      .update({ current_owner_id: buyerId, is_active: false })
      .eq('id', product.id)
  }

  // Service products: the buy flow already debited credits, so the service
  // order is auto-accepted and the buyer + seller need a communication
  // channel to coordinate delivery. Create the order row and a DM
  // conversation; include both IDs in the response so the UI can jump
  // straight into the session. Any failure here logs and continues —
  // credits already moved and we'd rather surface the order out-of-band
  // than block the buy.
  let service_order_id: string | null = null
  let conversation_id: string | null = null
  if (product.product_type === 'service') {
    const { data: order, error: orderErr } = await supabase
      .from('service_orders')
      .insert({
        product_id:    product.id,
        buyer_id:      buyerId,
        seller_id:     product.seller_id,
        brief:         `Paid upfront via marketplace: ${product.title}`,
        price_credits: product.price_credits,
        status:        'accepted',
      })
      .select('id')
      .single()

    if (orderErr) {
      console.error('[buy] service_orders insert failed:', orderErr.message)
    } else {
      service_order_id = order.id
    }

    // Open a conversation so buyer and seller can coordinate. Conversations
    // are keyed by a sorted participant pair, so fetch-or-create is safe.
    const [pa, pb] = [buyerId, product.seller_id].sort()
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_a', pa)
      .eq('participant_b', pb)
      .maybeSingle()

    if (existingConv) {
      conversation_id = existingConv.id
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({ participant_a: pa, participant_b: pb })
        .select('id')
        .single()
      if (convErr) {
        console.error('[buy] conversations insert failed:', convErr.message)
      } else {
        conversation_id = newConv.id
      }
    }

    // Seed the conversation with a system-style opening message so the
    // seller sees context immediately and the thread isn't empty.
    if (conversation_id) {
      await supabase.from('messages').insert({
        conversation_id,
        sender_id: buyerId,
        content: `Hi — I just purchased "${product.title}" (${product.price_credits} AA). Ready to start when you are.`,
      })
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation_id)
    }
  }

  // Notify the seller that a sale happened + fire their webhook
  await createNotification({
    userId: product.seller_id,
    type: 'sale',
    title: `"${product.title}" was purchased`,
    body: `You earned ${product.price_credits - seller_fee} AA (after fees).`,
    link: `/marketplace/${product.id}`,
    event: 'product_purchased',
    data: {
      product_id:    product.id,
      product_title: product.title,
      buyer_id:      buyerId,
      price_credits: product.price_credits,
      seller_fee,
      seller_received: product.price_credits - seller_fee,
      transaction_id: txId,
    },
  })

  return apiSuccess({
    transaction_id: txId,
    product_id:     product.id,
    product_type:   product.product_type,
    buyer_fee,
    seller_fee,
    file_url:  product.file_url,
    file_name: product.file_name,
    service_order_id,
    conversation_id,
  })
}
