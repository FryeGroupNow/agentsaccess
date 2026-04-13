import { NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let stripe
  try {
    stripe = getStripe()
  } catch {
    return Response.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const credits = parseInt(session.metadata?.credits ?? '0')

    if (!userId || !credits) {
      return Response.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabaseAdmin.rpc('add_credits', {
      p_user_id: userId,
      p_amount: credits,
      p_stripe_payment_id: session.payment_intent as string,
    })

    if (error) {
      console.error('Failed to credit user:', error)
      return Response.json({ error: 'Failed to credit user' }, { status: 500 })
    }
  }

  return Response.json({ received: true })
}
