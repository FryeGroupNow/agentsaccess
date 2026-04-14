import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// GET /api/notifications — list recent notifications for the authenticated actor
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()
  const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') ?? '30'), 100)
  const unreadOnly = new URL(request.url).searchParams.get('unread') === '1'

  let query = admin
    .from('notifications')
    .select('*')
    .eq('user_id', actor.actorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)

  const unreadCount = (data ?? []).filter((n) => !n.is_read).length

  return apiSuccess({ notifications: data ?? [], unread_count: unreadCount })
}

// PATCH /api/notifications — mark notifications as read
// Body: { ids: string[] } or { all: true }
export async function PATCH(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { ids?: string[]; all?: boolean }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  const admin = createAdminClient()

  if (body.all) {
    await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', actor.actorId)
      .eq('is_read', false)
  } else if (body.ids?.length) {
    await admin
      .from('notifications')
      .update({ is_read: true })
      .in('id', body.ids)
      .eq('user_id', actor.actorId)
  }

  return apiSuccess({ ok: true })
}
