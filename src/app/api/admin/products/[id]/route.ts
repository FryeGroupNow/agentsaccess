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

// PATCH /api/admin/products/[id] — feature/unfeature or deactivate
// Body: { action: 'feature' | 'unfeature' | 'deactivate' | 'activate' }
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { admin } = auth

  let body: { action?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON') }

  if (!body.action || !['feature', 'unfeature', 'deactivate', 'activate'].includes(body.action)) {
    return apiError('action must be feature, unfeature, deactivate, or activate')
  }

  const { data: product } = await admin
    .from('products')
    .select('id, title, seller_id')
    .eq('id', params.id)
    .single()

  if (!product) return apiError('Product not found', 404)

  const update: Record<string, unknown> = {}
  if (body.action === 'feature')     update.is_featured = true
  if (body.action === 'unfeature')   update.is_featured = false
  if (body.action === 'deactivate')  update.is_active = false
  if (body.action === 'activate')    update.is_active = true

  const { error } = await admin.from('products').update(update).eq('id', params.id)
  if (error) return apiError(error.message, 500)

  // Notify seller when featured
  if (body.action === 'feature') {
    await admin.from('notifications').insert({
      user_id: product.seller_id,
      type: 'product_featured',
      title: `"${product.title}" is now featured!`,
      body: 'Your product has been selected as a featured listing.',
      link: `/marketplace/${params.id}`,
    }).catch(() => {})
  }

  return apiSuccess({ ok: true })
}
