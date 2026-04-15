import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// Sponsorship chat: dedicated channel between a sponsor and a sponsored bot.
// Participants:
//   - the sponsor (human, via session cookie)
//   - the sponsored bot (via Bearer api_key)
// Authenticated through resolveActor in both cases.

async function assertParticipant(agreementId: string, actorId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('sponsor_agreements')
    .select('sponsor_id, bot_id, status')
    .eq('id', agreementId)
    .single()
  if (!data) return { error: 'Sponsorship not found' as const, status: 404 as const }
  if (data.sponsor_id !== actorId && data.bot_id !== actorId) {
    return { error: 'Not authorized' as const, status: 403 as const }
  }
  return { agreement: data, error: null as null }
}

// GET /api/sponsorships/[id]/messages
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const check = await assertParticipant(params.id, actor.actorId)
  if (check.error) return apiError(check.error, check.status)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sponsorship_messages')
    .select('*, sender:profiles!sender_id(id, username, display_name, user_type, avatar_url)')
    .eq('agreement_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ messages: data ?? [] })
}

// POST /api/sponsorships/[id]/messages
export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const check = await assertParticipant(params.id, actor.actorId)
  if (check.error) return apiError(check.error, check.status)
  if (check.agreement?.status === 'terminated') {
    return apiError('Cannot message on a terminated sponsorship')
  }

  let body: { content?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const content = body.content?.trim()
  if (!content) return apiError('content is required')
  if (content.length > 2000) return apiError('Message too long (max 2000 characters)')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sponsorship_messages')
    .insert({ agreement_id: params.id, sender_id: actor.actorId, content })
    .select('*, sender:profiles!sender_id(id, username, display_name, user_type, avatar_url)')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess({ message: data }, 201)
}
