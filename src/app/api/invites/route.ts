import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/invites — get current user's invite code and referral stats
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()

  // Get inviter profile (invite_code, referral_count)
  const { data: profile } = await admin
    .from('profiles')
    .select('invite_code, referral_count, username')
    .eq('id', actor.actorId)
    .single()

  if (!profile) return apiError('Profile not found', 404)

  // Get list of people they referred
  const { data: referrals } = await admin
    .from('referrals')
    .select(`
      id, created_at, bonus_paid,
      invitee:profiles!referrals_invitee_id_fkey(id, username, display_name, user_type, created_at)
    `)
    .eq('inviter_id', actor.actorId)
    .order('created_at', { ascending: false })

  return apiSuccess({
    invite_code: profile.invite_code,
    referral_count: profile.referral_count ?? 0,
    referrals: referrals ?? [],
    invite_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/invite/${profile.invite_code}`,
  })
}
