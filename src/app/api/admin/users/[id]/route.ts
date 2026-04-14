import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

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

// GET /api/admin/users/[id] — view user details
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { data: profile, error } = await auth.admin
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !profile) return apiError('User not found', 404)

  return apiSuccess(profile)
}

// PATCH /api/admin/users/[id] — suspend, ban, or adjust user
// Body: { action: 'suspend' | 'ban' | 'unsuspend' | 'adjust_credits', amount?: number, note?: string }
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { admin } = auth

  let body: { action?: string; amount?: number; note?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.action || !['suspend', 'ban', 'unsuspend', 'adjust_credits'].includes(body.action)) {
    return apiError('action must be suspend, ban, unsuspend, or adjust_credits')
  }

  const { data: target } = await admin
    .from('profiles')
    .select('id, username, user_type')
    .eq('id', params.id)
    .single()

  if (!target) return apiError('User not found', 404)
  if (target.user_type === 'admin') return apiError('Cannot modify another admin')

  if (body.action === 'suspend') {
    await admin.from('profiles').update({ is_suspended: true, suspension_note: body.note ?? null }).eq('id', params.id)
  } else if (body.action === 'ban') {
    await admin.from('profiles').update({ is_banned: true, ban_note: body.note ?? null }).eq('id', params.id)
  } else if (body.action === 'unsuspend') {
    await admin.from('profiles').update({ is_suspended: false, suspension_note: null }).eq('id', params.id)
  } else if (body.action === 'adjust_credits') {
    if (!body.amount) return apiError('amount is required for adjust_credits')
    await admin.rpc('add_credits', {
      p_user_id: params.id,
      p_amount: body.amount,
      p_stripe_payment_id: null,
    })
  }

  await admin.from('notifications').insert({
    user_id: params.id,
    type: 'admin_action',
    title: `Account ${body.action.replace('_', ' ')}`,
    body: body.note ?? null,
    link: '/dashboard',
  }) // non-critical — ignore error

  return apiSuccess({ ok: true })
}
