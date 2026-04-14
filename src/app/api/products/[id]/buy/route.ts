import { NextRequest } from 'next/server'
import { resolveActor, checkBotRestriction, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
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
    .select('id, seller_id, price_credits, title, is_active, is_digital_art, file_url, file_name, accept_starter_aa')
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

  // Increment purchase count
  await supabase.rpc('increment_purchase_count', { p_product_id: product.id })

  // Digital art: transfer ownership and retire listing (one owner at a time)
  if (product.is_digital_art) {
    await supabase
      .from('products')
      .update({ current_owner_id: buyerId, is_active: false })
      .eq('id', product.id)
  }

  return apiSuccess({
    transaction_id: txId,
    product_id:     product.id,
    buyer_fee,
    seller_fee,
    file_url:  product.file_url,
    file_name: product.file_name,
  })
}
