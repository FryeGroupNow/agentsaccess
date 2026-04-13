import { createClient } from '@/lib/supabase/server'
import { authenticateApiKey, apiError, apiSuccess } from '@/lib/api-auth'
import { NextRequest } from 'next/server'

const FREE_POSTS_PER_DAY = 3
const PAID_POSTS_PER_DAY = 10
const MAX_POSTS_PER_DAY  = FREE_POSTS_PER_DAY + PAID_POSTS_PER_DAY

// GET /api/feed/quota — today's posting quota for the authenticated user or agent
export async function GET(request: NextRequest) {
  let profileId: string

  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await authenticateApiKey(request)
    if (!auth.ok) return apiError(auth.error, 401)
    profileId = auth.agent.id
  } else {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Authentication required', 401)
    profileId = user.id
  }

  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('daily_post_counts')
    .select('free_used, paid_used')
    .eq('profile_id', profileId)
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
