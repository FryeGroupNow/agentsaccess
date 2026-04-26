import { createAdminClient } from '@/lib/supabase/admin'
import { SIGNUP_BONUS_CREDITS } from '@/types'
import { sendWelcomeEmail } from '@/lib/email'
import type { User } from '@supabase/supabase-js'

/**
 * Ensures a profile row exists for a human user, and self-heals the
 * signup bonus if the DB trigger was skipped or failed.
 *
 * Idempotent — safe to call on every dashboard visit. Uses the service
 * role so RLS never blocks it.
 */
export async function ensureProfile(user: User): Promise<void> {
  const admin = createAdminClient()

  // Load current profile (if any)
  const { data: existing } = await admin
    .from('profiles')
    .select('id, user_type, credit_balance, bonus_balance')
    .eq('id', user.id)
    .maybeSingle()

  let profile = existing as {
    id: string
    user_type: string
    credit_balance: number
    bonus_balance: number
  } | null

  // ── Create the profile if the handle_new_user trigger missed it ──────────
  if (!profile) {
    const username =
      user.user_metadata?.username ||
      user.user_metadata?.preferred_username ||
      user.email?.split('@')[0]?.replace(/[^a-z0-9-_]/gi, '').toLowerCase() ||
      'user-' + Math.random().toString(36).slice(2, 7)

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
    profile = { id: user.id, user_type: 'human', credit_balance: 0, bonus_balance: 0 }
  }

  // ── Welcome email (once per profile) ────────────────────────────────────
  // Fire after the row exists so getRecipient() can read notification_prefs
  // and the unsub-token column. We claim the slot by stamping
  // welcome_email_sent_at first to avoid double-sends across concurrent
  // dashboard loads.
  if (profile.user_type === 'human') {
    const { data: claim } = await admin
      .from('profiles')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('welcome_email_sent_at', null)
      .select('id')
      .maybeSingle()

    if (claim) {
      // Fire-and-forget — never block dashboard render on email delivery.
      sendWelcomeEmail(user.id).catch((err) =>
        console.error('[welcome-email] failed for', user.id, err)
      )
    }
  }

  // ── Self-heal the signup bonus ──────────────────────────────────────────
  // The DB trigger `grant_signup_bonus` is supposed to grant 10 Starter AA
  // on profile INSERT. It can silently fail (the function has a WHEN OTHERS
  // handler that swallows errors) or it simply may never have been applied
  // to this environment. To make the platform robust against both cases,
  // we grant the bonus here if and only if:
  //   - the user is human
  //   - bonus_balance is zero
  //   - no signup_bonus transaction exists for this user
  //
  // Once a signup_bonus transaction is present, this block is a no-op, so
  // it's safe to run on every dashboard visit.
  if (profile.user_type === 'human' && profile.bonus_balance === 0) {
    const { data: existingBonus } = await admin
      .from('transactions')
      .select('id')
      .eq('to_id', user.id)
      .eq('type', 'signup_bonus')
      .maybeSingle()

    if (!existingBonus) {
      const { error: txError } = await admin.from('transactions').insert({
        to_id: user.id,
        amount: SIGNUP_BONUS_CREDITS,
        type: 'signup_bonus',
        notes: 'Welcome bonus — Starter AA Credits',
      })

      if (txError) {
        console.error('ensureProfile: bonus transaction failed for', user.id, txError.message)
        return
      }

      const { error: updateError } = await admin
        .from('profiles')
        .update({
          credit_balance: profile.credit_balance + SIGNUP_BONUS_CREDITS,
          bonus_balance:  profile.bonus_balance  + SIGNUP_BONUS_CREDITS,
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('ensureProfile: balance update failed for', user.id, updateError.message)
      }
    }
  }
}
