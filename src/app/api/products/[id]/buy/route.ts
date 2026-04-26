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

  // Increment purchase_count. Previous revisions tried the
  // increment_purchase_count RPC with a fallback, but Billy reported
  // counts still stuck at 0 after real buys. The RPC path was silently
  // returning success without actually updating (likely a stale
  // schema-cached function signature mismatch), so the fallback never
  // fired. Drop the RPC entirely and do a direct read-then-write with
  // the admin (service-role) client, which bypasses RLS and the
  // "Sellers manage own products" policy that would otherwise block a
  // buyer-initiated update. Read the new value back via `select()` so
  // we can log it and return it to the client — impossible to be
  // silently wrong again.
  let new_purchase_count: number | null = null
  {
    const { data: current, error: readErr } = await supabase
      .from('products')
      .select('purchase_count')
      .eq('id', product.id)
      .single()

    if (readErr) {
      console.error('[buy] purchase_count read failed:', readErr.message)
    } else {
      const next = (current?.purchase_count ?? 0) + 1
      const { data: updated, error: updateErr } = await supabase
        .from('products')
        .update({ purchase_count: next })
        .eq('id', product.id)
        .select('purchase_count')
        .single()

      if (updateErr) {
        console.error('[buy] purchase_count update failed:', updateErr.message)
      } else {
        new_purchase_count = updated?.purchase_count ?? null
        console.log(`[buy] ${product.id} purchase_count: ${current?.purchase_count ?? 0} -> ${new_purchase_count}`)
      }
    }
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
    // seller sees context immediately and the thread isn't empty. Sender
    // is the buyer (no separate "system" identity exists), but the format
    // makes it read as an order header rather than a personal note.
    if (conversation_id && service_order_id) {
      const orderTag = service_order_id.slice(0, 8)
      await supabase.from('messages').insert({
        conversation_id,
        sender_id: buyerId,
        content:
          `Order #${orderTag} — buyer purchased "${product.title}" for ${product.price_credits} AA. ` +
          `Seller, please reach out to schedule or deliver.`,
      })
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation_id)
    }

    // Notify both parties so they see the order in their inboxes (and so
    // the seller's webhook fires a service_request event with the order
    // ID embedded). Each side gets its own role-tagged payload.
    if (service_order_id) {
      const orderShort = service_order_id.slice(0, 8)
      const sharedData = {
        order_id:        service_order_id,
        product_id:      product.id,
        product_title:   product.title,
        price_credits:   product.price_credits,
        conversation_id,
        status:          'accepted',
      }
      await Promise.all([
        createNotification({
          userId: product.seller_id,
          type:   'service_request',
          title:  `Order #${orderShort}: deliver "${product.title}"`,
          body:   `Buyer paid ${product.price_credits} AA upfront. Open the chat to start delivery.`,
          link:   conversation_id ? `/messages/${conversation_id}` : '/dashboard?tab=services',
          event:  'service_request',
          data:   { ...sharedData, role: 'seller', buyer_id: buyerId },
        }),
        createNotification({
          userId: buyerId,
          type:   'service_request',
          title:  `Order #${orderShort}: "${product.title}" purchased`,
          body:   'Your service order is open. The seller will reach out to deliver.',
          link:   conversation_id ? `/messages/${conversation_id}` : '/dashboard?tab=services',
          event:  'service_request',
          data:   { ...sharedData, role: 'buyer', seller_id: product.seller_id },
        }),
      ])
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
    new_purchase_count,
  })
}
