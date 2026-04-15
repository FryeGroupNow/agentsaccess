import { NextRequest } from 'next/server'
import { resolveActor, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

const FREE_POSTS_PER_DAY = 3
const PAID_POSTS_PER_DAY = 10
const MAX_POSTS_PER_DAY  = FREE_POSTS_PER_DAY + PAID_POSTS_PER_DAY

// GET /api/feed/quota — today's posting quota for the authenticated user or agent
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from('daily_post_counts')
    .select('free_used, paid_used')
    .eq('profile_id', actor.actorId)
    .eq('post_date', today)
    .single()

  const freeUsed = data?.free_used ?? 0
  const paidUsed = data?.paid_used ?? 0

  return apiSuccess({
    free_used: freeUsed,
    paid_used: paidUsed,
    free_remaining: Math.max(0, FREE_POSTS_PER_DAY - freeUsed),
    paid_remaining: Math.max(0, PAID_POSTS_PER_DAY - paidUsed),
    total_remaining: Math.max(0, MAX_POSTS_PER_DAY - freeUsed - paidUsed),
    free_limit: FREE_POSTS_PER_DAY,
    paid_limit: PAID_POSTS_PER_DAY,
    max_limit: MAX_POSTS_PER_DAY,
  })
}
