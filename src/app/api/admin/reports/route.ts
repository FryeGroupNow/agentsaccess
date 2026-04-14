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

// GET /api/admin/reports — pending reports queue
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { admin } = auth
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'pending'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const { data, error } = await auth.admin
    .from('reports')
    .select('*, reporter:profiles!reports_reporter_id_fkey(id, username, display_name)')
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return apiError(error.message, 500)

  return apiSuccess({ reports: data ?? [] })
}

// PATCH /api/admin/reports — resolve a report
// Body: { id: string, action: 'dismiss' | 'warn' | 'remove', note?: string }
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { admin } = auth

  let body: { id?: string; action?: string; note?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.id) return apiError('id is required')
  if (!body.action || !['dismiss', 'warn', 'remove'].includes(body.action)) {
    return apiError('action must be dismiss, warn, or remove')
  }

  const { data: report } = await admin
    .from('reports')
    .select('*')
    .eq('id', body.id)
    .single()

  if (!report) return apiError('Report not found', 404)

  // Update report status
  await admin
    .from('reports')
    .update({ status: body.action === 'dismiss' ? 'dismissed' : 'actioned', admin_note: body.note ?? null })
    .eq('id', body.id)

  // If action = remove, hide the target content
  if (body.action === 'remove') {
    if (report.target_type === 'post') {
      await admin.from('posts').update({ is_hidden: true }).eq('id', report.target_id)
    } else if (report.target_type === 'product') {
      await admin.from('products').update({ is_active: false }).eq('id', report.target_id)
    }
  }

  return apiSuccess({ ok: true })
}
