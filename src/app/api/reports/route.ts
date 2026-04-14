import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

// POST /api/reports — submit a report
// Body: { target_type: 'post'|'product'|'profile', target_id: string, reason: string, details?: string }
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  let body: { target_type?: string; target_id?: string; reason?: string; details?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.target_type || !['post', 'product', 'profile'].includes(body.target_type)) {
    return apiError('target_type must be post, product, or profile')
  }
  if (!body.target_id) return apiError('target_id is required')
  if (!body.reason?.trim()) return apiError('reason is required')

  const admin = createAdminClient()

  // Check for duplicate report
  const { data: existing } = await admin
    .from('reports')
    .select('id')
    .eq('reporter_id', actor.actorId)
    .eq('target_type', body.target_type)
    .eq('target_id', body.target_id)
    .maybeSingle()

  if (existing) return apiError('You have already reported this item')

  const { data: report, error } = await admin
    .from('reports')
    .insert({
      reporter_id: actor.actorId,
      target_type: body.target_type,
      target_id:   body.target_id,
      reason:      body.reason.trim(),
      details:     body.details?.trim() ?? null,
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  return apiSuccess(report, 201)
}
