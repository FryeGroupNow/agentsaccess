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
  | 'rental_queue_joined'
  | 'rental_queue_claim'
  | 'rental_queue_started'
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

/**
 * Best-effort email fallback via Resend REST API. Zero-dep — uses fetch
 * directly. Only sends when RESEND_API_KEY and RESEND_FROM_EMAIL are set;
 * otherwise logs and returns. Never throws — email is strictly
 * belt-and-suspenders on top of in-app notifications and webhooks.
 */
async function sendEmailFallback(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    console.log('[notify] email fallback skipped (RESEND_API_KEY not configured):', to, subject)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    })
    if (!res.ok) {
      console.error('[notify] email fallback failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[notify] email fallback threw:', err)
  }
}

/**
 * When a notification targets a bot (user_type='agent'), also fan out a
 * copy to the bot's human owner so they never miss what their bots are
 * doing. Best-effort — any error logs but doesn't affect the main write.
 */
async function fanoutToBotOwner(
  botUserId: string,
  input: NotificationInput
): Promise<void> {
  const admin = createAdminClient()
  const { data: bot } = await admin
    .from('profiles')
    .select('user_type, owner_id, username, display_name')
    .eq('id', botUserId)
    .maybeSingle()

  if (!bot || bot.user_type !== 'agent' || !bot.owner_id) return

  // Mirror the notification into the owner's inbox, tagged so the UI can
  // distinguish "event on your bot" from the owner's own events.
  const ownerTitle = `[@${bot.username}] ${input.title}`
  await admin.from('notifications').insert({
    user_id: bot.owner_id,
    type: `bot_${input.type}`,
    title: ownerTitle,
    body: input.body ?? null,
    link: input.link ?? null,
    data: {
      ...(input.data ?? {}),
      bot_id: botUserId,
      bot_username: bot.username,
      bot_display_name: bot.display_name,
      origin: 'bot_fanout',
    },
  })

  // Owner's own webhook also fires so they can aggregate bot events.
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('webhook_url')
    .eq('id', bot.owner_id)
    .maybeSingle()

  if (ownerProfile?.webhook_url && input.event) {
    sendWebhookWithRetry(ownerProfile.webhook_url, {
      event: `bot_${input.event}`,
      data: {
        bot_id: botUserId,
        bot_username: bot.username,
        ...(input.data ?? {}),
        title: ownerTitle,
        body: input.body ?? null,
      },
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error('[notify] owner webhook delivery error', err))
  }

  // Email fallback: only fire for high-signal events (new message,
  // product purchased, service request) to avoid flooding inboxes.
  const EMAIL_EVENTS: Array<WebhookEvent | undefined> = ['new_message', 'product_purchased', 'service_request']
  if (EMAIL_EVENTS.includes(input.event)) {
    // auth.users holds the email; profiles does not. We need the admin
    // client's auth API to fetch it.
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(bot.owner_id)
      const email = userRes?.user?.email
      if (email) {
        await sendEmailFallback(
          email,
          ownerTitle,
          `${input.body ?? ''}\n\nBot: @${bot.username} (${bot.display_name})\nLink: ${process.env.NEXT_PUBLIC_APP_URL ?? ''}${input.link ?? '/dashboard'}\n`
        )
      }
    } catch (err) {
      console.error('[notify] owner email lookup failed:', err)
    }
  }
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

  // Fan out to the bot's owner so owners never miss what their bots are
  // doing. Safe no-op for human recipients.
  fanoutToBotOwner(input.userId, input).catch((err) =>
    console.error('[notify] fanoutToBotOwner error', err)
  )

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
