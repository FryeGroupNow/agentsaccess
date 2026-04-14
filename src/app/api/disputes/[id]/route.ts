import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// PATCH /api/disputes/[id] — admin resolves a dispute
// Body: { status: 'resolved' | 'rejected', resolution_note?: string, refund_amount?: number }
export async function PATCH(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  // Only admins can resolve disputes
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', actor.actorId)
    .single()

  if (profile?.user_type !== 'admin') {
    return apiError('Admin access required', 403)
  }

  let body: { status?: string; resolution_note?: string; refund_amount?: number }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.status || !['resolved', 'rejected'].includes(body.status)) {
    return apiError('status must be resolved or rejected')
  }

  // Fetch the dispute
  const { data: dispute } = await admin
    .from('disputes')
    .select('*, product:products(id, title, price_credits)')
    .eq('id', params.id)
    .single()

  if (!dispute) return apiError('Dispute not found', 404)
  if (dispute.status !== 'open') return apiError('Dispute is already closed')

  const updates: Record<string, unknown> = {
    status: body.status,
    resolved_at: new Date().toISOString(),
    resolution_note: body.resolution_note?.trim() ?? null,
  }

  // Handle refund if resolved with refund amount
  if (body.status === 'resolved' && body.refund_amount && body.refund_amount > 0) {
    const refundAmount = Math.min(body.refund_amount, dispute.product?.price_credits ?? 0)

    // Deduct from seller, credit buyer
    const { error: deductErr } = await admin.rpc('transfer_credits', {
      p_from_id: dispute.seller_id,
      p_to_id: dispute.buyer_id,
      p_amount: refundAmount,
      p_type: 'dispute_refund',
      p_meta: { dispute_id: dispute.id },
    })

    if (deductErr) return apiError('Failed to process refund: ' + deductErr.message, 500)
    updates.refund_amount = refundAmount
  }

  const { data: updated, error } = await admin
    .from('disputes')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  // Notify buyer and seller
  const title = body.status === 'resolved'
    ? `Dispute resolved on "${dispute.product?.title}"`
    : `Dispute rejected on "${dispute.product?.title}"`

  await Promise.all([
    admin.from('notifications').insert({
      user_id: dispute.buyer_id,
      type: 'dispute_resolved',
      title,
      body: body.resolution_note?.slice(0, 100) ?? null,
      link: '/dashboard',
      data: { dispute_id: dispute.id, status: body.status },
    }),
    admin.from('notifications').insert({
      user_id: dispute.seller_id,
      type: 'dispute_resolved',
      title,
      body: body.resolution_note?.slice(0, 100) ?? null,
      link: '/dashboard',
      data: { dispute_id: dispute.id, status: body.status },
    }),
  ])

  return apiSuccess(updated)
}

// GET /api/disputes/[id] — get a single dispute
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const admin = createAdminClient()

  const { data: dispute, error } = await admin
    .from('disputes')
    .select(`
      *,
      product:products(id, title, price_credits),
      buyer:profiles!disputes_buyer_id_fkey(id, username, display_name),
      seller:profiles!disputes_seller_id_fkey(id, username, display_name)
    `)
    .eq('id', params.id)
    .single()

  if (error || !dispute) return apiError('Dispute not found', 404)

  // Only buyer, seller, or admin can view
  const { data: profile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', actor.actorId)
    .single()

  const isParticipant = dispute.buyer_id === actor.actorId || dispute.seller_id === actor.actorId
  const isAdmin = profile?.user_type === 'admin'

  if (!isParticipant && !isAdmin) return apiError('Access denied', 403)

  return apiSuccess(dispute)
}
