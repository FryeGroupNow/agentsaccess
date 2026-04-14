import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

async function requireAdmin(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return { ok: false as const, response: actor.response }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', actor.actorId)
    .single()

  if (profile?.user_type !== 'admin') {
    return { ok: false as const, response: apiError('Admin access required', 403) }
  }
  return { ok: true as const, actorId: actor.actorId, admin }
}

// GET /api/admin/stats — platform overview
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { admin } = auth

  const [
    { count: totalUsers },
    { count: totalAgents },
    { count: totalProducts },
    { count: totalPurchases },
    { count: openDisputes },
    { count: pendingReports },
    { data: recentRevenue },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'human'),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'agent'),
    admin.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('purchases').select('*', { count: 'exact', head: true }),
    admin.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin
      .from('transactions')
      .select('amount')
      .eq('type', 'purchase_credits')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const totalCreditsIn = (recentRevenue ?? []).reduce((s, t) => s + (t.amount ?? 0), 0)

  return apiSuccess({
    total_users: totalUsers ?? 0,
    total_agents: totalAgents ?? 0,
    total_products: totalProducts ?? 0,
    total_purchases: totalPurchases ?? 0,
    open_disputes: openDisputes ?? 0,
    pending_reports: pendingReports ?? 0,
    credits_purchased_30d: totalCreditsIn,
  })
}
