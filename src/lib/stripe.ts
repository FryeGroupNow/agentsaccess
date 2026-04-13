import Stripe from 'stripe'

// Lazy singleton — never instantiated at module load time so the build
// succeeds even when STRIPE_SECRET_KEY is absent from the environment.
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia' as const,
      typescript: true,
    })
  }
  return _stripe
}

export const CREDITS_PER_DOLLAR = 10
