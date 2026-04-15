import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Centralized notification creator.
 *
 * Inserts a row into `notifications` for the target user and, if the user
 * has `webhook_url` set on their profile, POSTs the notification as a
 * webhook event. Webhook delivery runs "fire and forget" via
 * waitUntil-style detachment so we don't block the originating request on
 * a slow remote endpoint.
 *
 * The webhook payload is:
 *   {
 *     "event": "<event name>",
 *     "data": { ...notification row with id, type, title, body, link... },
 *     "timestamp": "<ISO 8601 now>"
 *   }
 *
 * Retry: on failure (non-2xx, network error, or timeout) the send is
 * retried exactly once after 30 seconds. No further retries.
 */

export type WebhookEvent =
  | 'new_message'
  | 'product_purchased'
  | 'new_follower'
  | 'sponsor_offer'
  | 'sponsor_accepted'
  | 'sponsor_rejected'
  | 'rental_request'
  | 'rental_ended'
  | 'post_liked'
  | 'post_disliked'
  | 'service_request'
  | 'review_posted'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'credits_received'
  | 'file_shared'

export interface NotificationInput {
  userId: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  /** Arbitrary structured data stored with the notification + sent in the
   *  webhook payload. */
  data?: Record<string, unknown>
  /** Event name used for the webhook. If omitted, the notification is
   *  stored but no webhook is fired. */
  event?: WebhookEvent
}

const WEBHOOK_TIMEOUT_MS = 10_000
const RETRY_DELAY_MS = 30_000

async function deliverWebhook(url: string, payload: unknown): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AgentsAccess-Webhook/1.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

async function sendWebhookWithRetry(url: string, payload: unknown): Promise<void> {
  const first = await deliverWebhook(url, payload)
  if (first) return
  // Single retry after RETRY_DELAY_MS (30 s)
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  await deliverWebhook(url, payload)
}

export async function createNotification(input: NotificationInput): Promise<void> {
  const admin = createAdminClient()

  // Insert the notification row. Non-critical — any error is logged and
  // the originating action is not rolled back.
  const { data: row, error } = await admin
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      data: input.data ?? null,
    })
    .select('id, user_id, type, title, body, link, data, created_at')
    .single()

  if (error) {
    console.error('createNotification: insert failed', error.message)
    return
  }

  if (!input.event) return

  // Look up the recipient's webhook URL
  const { data: profile } = await admin
    .from('profiles')
    .select('webhook_url')
    .eq('id', input.userId)
    .single()

  const url = profile?.webhook_url
  if (!url) return

  const payload = {
    event: input.event,
    data: row,
    timestamp: new Date().toISOString(),
  }

  // Fire and forget with retry — the originating request doesn't wait
  // for delivery. Errors are swallowed inside sendWebhookWithRetry.
  sendWebhookWithRetry(url, payload).catch((err) => {
    console.error('webhook delivery error', err)
  })
}
