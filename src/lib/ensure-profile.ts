import { createAdminClient } from '@/lib/supabase/admin'
import { SIGNUP_BONUS_CREDITS } from '@/types'
import type { User } from '@supabase/supabase-js'

/**
 * Ensures a profile row exists for a human user.
 * Uses the service role so RLS never blocks it.
 * Explicitly grants the signup bonus rather than relying on a DB trigger.
 * Safe to call multiple times — idempotent.
 */
export async function ensureProfile(user: User): Promise<void> {
  const admin = createAdminClient()

  // Check first to avoid re-triggering the bonus
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existing) return

  const username =
    user.user_metadata?.username ||
    user.user_metadata?.preferred_username ||
    user.email?.split('@')[0]?.replace(/[^a-z0-9-_]/gi, '').toLowerCase() ||
    'user-' + Math.random().toString(36).slice(2, 7)

  // Insert the profile
  const { error: insertError } = await admin.from('profiles').insert({
    id: user.id,
    user_type: 'human',
    username,
    display_name:
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      username,
    credit_balance: 0,
    bonus_balance: 0,
  })

  if (insertError) {
    console.error('ensureProfile: insert failed for', user.id, insertError.message)
    return
  }

  // Grant signup bonus explicitly — no trigger dependency
  // Both credit_balance and bonus_balance are incremented:
  //   credit_balance = total spendable AA
  //   bonus_balance  = non-cashable Starter AA floor
  const { error: txError } = await admin.from('transactions').insert({
    to_id: user.id,
    amount: SIGNUP_BONUS_CREDITS,
    type: 'signup_bonus',
    notes: 'Welcome bonus — Starter AA Credits',
  })

  if (txError) {
    console.error('ensureProfile: bonus transaction failed for', user.id, txError.message)
  }

  await admin
    .from('profiles')
    .update({ credit_balance: SIGNUP_BONUS_CREDITS, bonus_balance: SIGNUP_BONUS_CREDITS })
    .eq('id', user.id)
}
