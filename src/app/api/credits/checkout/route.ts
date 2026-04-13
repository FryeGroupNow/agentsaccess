import { NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { MIN_PURCHASE_CREDITS, calcStripeFees } from '@/types'
import { apiError, apiSuccess } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  let body: { credits?: number }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body')
  }

  const credits = Math.floor(body.credits ?? 0)
  if (!credits || credits < MIN_PURCHASE_CREDITS) {
    return apiError(`Minimum purchase is ${MIN_PURCHASE_CREDITS} credits`)
  }
  if (credits > 100_000) {
    return apiError('Maximum purchase is 100,000 credits per transaction')
  }

  let stripe
  try {
    stripe = getStripe()
  } catch {
    return apiError('Stripe is not configured on this server', 503)
  }

  const { base_usd, stripe_fee, total_charged } = calcStripeFees(credits)
  const unit_amount = Math.round(total_charged * 100) // Stripe uses cents

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${credits.toLocaleString()} AA Credits`,
            description: `${credits.toLocaleString()} AA Credits · $${base_usd.toFixed(2)} value + $${stripe_fee.toFixed(2)} processing fee`,
          },
          unit_amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata: {
      user_id: user.id,
      credits: credits.toString(),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?credits_purchased=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  })

  return apiSuccess({ url: session.url })
}
