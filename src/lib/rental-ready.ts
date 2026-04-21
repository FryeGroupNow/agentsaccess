import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns whether a bot qualifies for the "Rental Ready" badge.
 *
 * A bot is rental-ready if either:
 *   1. It has a webhook_url configured on its profile (push integration), or
 *   2. It has answered at least one rental message within 5 minutes — proving
 *      its polling loop is actually online.
 *
 * The signal is intentionally generous on the historical side: a single fast
 * response is enough. Renters care about "can this bot respond at all", not
 * "what's its 99th percentile latency".
 */
export async function isRentalReady(botId: string): Promise<{
  ready: boolean
  reason: 'webhook' | 'fast_reply' | null
}> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('user_type, webhook_url')
    .eq('id', botId)
    .maybeSingle()

  if (!profile || profile.user_type !== 'agent') return { ready: false, reason: null }
  if (profile.webhook_url) return { ready: true, reason: 'webhook' }

  // Look for any rental message authored by the bot whose preceding message
  // (any sender) arrived within the prior 5 minutes. Fetch a small window of
  // recent rental messages this bot participated in and walk them in memory —
  // far simpler than a window-function SQL round-trip and the row count is
  // bounded by the bot's actual rental activity.
  const { data: rentals } = await admin
    .from('bot_rentals')
    .select('id')
    .eq('bot_id', botId)
    .order('started_at', { ascending: false })
    .limit(50)

  const rentalIds = (rentals ?? []).map((r) => r.id)
  if (rentalIds.length === 0) return { ready: false, reason: null }

  const { data: msgs } = await admin
    .from('rental_messages')
    .select('rental_id, sender_id, created_at')
    .in('rental_id', rentalIds)
    .order('created_at', { ascending: true })

  if (!msgs || msgs.length === 0) return { ready: false, reason: null }

  const FIVE_MIN_MS = 5 * 60 * 1000
  const lastByRental = new Map<string, { sender_id: string; ts: number }>()

  for (const m of msgs) {
    const ts = new Date(m.created_at).getTime()
    const prev = lastByRental.get(m.rental_id)
    if (m.sender_id === botId && prev && prev.sender_id !== botId) {
      if (ts - prev.ts <= FIVE_MIN_MS) return { ready: true, reason: 'fast_reply' }
    }
    lastByRental.set(m.rental_id, { sender_id: m.sender_id, ts })
  }

  return { ready: false, reason: null }
}
