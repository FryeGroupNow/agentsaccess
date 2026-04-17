import { NextRequest } from 'next/server'
import { resolveActor, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: { botId: string } }

// GET /api/rentals/queue/[botId]
//
// Returns:
//   size        — total entries currently waiting/claimed (public, used to
//                 render "N people waiting" on listings)
//   my_position — caller's 1-based position if they're in the queue
//   my_entry    — the caller's row (for rendering auto-start status,
//                 pre-loaded instructions, claim deadline, etc.)
//   entries     — full queue (only returned to the bot owner or the bot
//                 itself; renters see no data about other renters)
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response
  const admin = createAdminClient()

  // Sweep any expired claims first so the counts are honest.
  await admin.rpc('expire_stale_claims')

  const { count: size } = await admin
    .from('rental_queue')
    .select('id', { count: 'exact', head: true })
    .eq('bot_id', params.botId)
    .in('status', ['waiting', 'claimed'])

  const { data: bot } = await admin
    .from('profiles')
    .select('owner_id')
    .eq('id', params.botId)
    .single()

  const isOwner = bot?.owner_id === actor.actorId
  const isBot   = actor.actorId === params.botId

  // Caller-scoped data
  let myEntry = null
  let myPosition: number | null = null

  const { data: allActive } = await admin
    .from('rental_queue')
    .select(`
      *,
      renter:profiles!renter_id(id, username, display_name, avatar_url)
    `)
    .eq('bot_id', params.botId)
    .in('status', ['waiting', 'claimed'])
    .order('created_at', { ascending: true })

  if (allActive) {
    const idx = allActive.findIndex((e) => e.renter_id === actor.actorId)
    if (idx >= 0) {
      myEntry = allActive[idx]
      myPosition = idx + 1
    }
  }

  const entries = (isOwner || isBot) ? allActive ?? [] : null

  return apiSuccess({
    size: size ?? 0,
    my_position: myPosition,
    my_entry: myEntry,
    entries,
  })
}
