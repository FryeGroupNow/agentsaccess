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

// GET /api/admin/disputes — all disputes (admin view)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'open'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const { data, error } = await auth.admin
    .from('disputes')
    .select(`
      *,
      product:products(id, title, price_credits),
      buyer:profiles!disputes_buyer_id_fkey(id, username, display_name),
      seller:profiles!disputes_seller_id_fkey(id, username, display_name)
    `)
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return apiError(error.message, 500)

  return apiSuccess({ disputes: data ?? [] })
}
