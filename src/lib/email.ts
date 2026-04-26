import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'node:crypto'

/**
 * Transactional email module — built on the existing Resend integration
 * already used by `src/lib/notify.ts`. Every public function is best-effort:
 * if RESEND_API_KEY isn't configured we log + return so a missing env var
 * never blocks the originating action (signup, purchase, etc.).
 *
 * All templates share a single mobile-friendly HTML shell with an
 * unsubscribe footer. Per-recipient preferences are honoured before
 * sending — the caller passes a `prefKey` (matching a key in
 * profiles.notification_prefs) and we skip if that key is set to 'off' or
 * 'in_app'. Welcome and purchase confirmation emails always send (they're
 * essential, not promotional).
 */

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentsaccess.ai'
const FROM     = process.env.RESEND_FROM_EMAIL ?? 'AgentsAccess <noreply@agentsaccess.ai>'

interface SendArgs {
  to: string
  subject: string
  html: string
  text: string
  /** Resend tag for grouping in the dashboard (e.g. "purchase_confirmation"). */
  tag?: string
}

/**
 * Low-level Resend POST. Never throws; returns true on 2xx.
 */
async function send({ to, subject, html, text, tag }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[email] skipped (RESEND_API_KEY not set):', subject, '→', to)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject,
        html,
        text,
        tags: tag ? [{ name: 'category', value: tag }] : undefined,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[email] Resend rejected:', res.status, body)
      return false
    }
    return true
  } catch (err) {
    console.error('[email] send threw:', err)
    return false
  }
}

/**
 * Look up a user's email and notification preferences. Returns null if the
 * user has no email or has opted out of this category.
 */
async function getRecipient(userId: string, prefKey?: string): Promise<{
  email: string
  displayName: string
  unsubToken: string
} | null> {
  const admin = createAdminClient()

  // notification_prefs lives on profiles; auth.users holds the email.
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, notification_prefs, email_unsub_token')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null

  if (prefKey) {
    const level = (profile.notification_prefs as Record<string, string> | null)?.[prefKey]
    // 'in_app_email' opts in; 'in_app' or 'off' opts out of email.
    if (level && level !== 'in_app_email') return null
  }

  let unsubToken = profile.email_unsub_token as string | null
  if (!unsubToken) {
    unsubToken = crypto.randomBytes(24).toString('hex')
    await admin.from('profiles').update({ email_unsub_token: unsubToken }).eq('id', userId)
  }

  const { data: auth } = await admin.auth.admin.getUserById(userId)
  const email = auth?.user?.email
  if (!email) return null

  return {
    email,
    displayName: (profile.display_name as string) || 'there',
    unsubToken,
  }
}

// ── Shared layout ──────────────────────────────────────────────────────────
//
// We deliberately ship inline-styled HTML (no external stylesheets — most
// email clients strip them) and keep the visual language plain enough to
// look right in Gmail, Outlook, Apple Mail, and a phone screen.

interface LayoutOpts {
  title: string
  preheader: string
  bodyHtml: string
  cta?: { label: string; href: string }
  /** Footer note above the unsubscribe link. */
  footerNote?: string
  unsubUrl: string
}

function htmlLayout(opts: LayoutOpts): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(opts.preheader)}
  </span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 12px;border-bottom:1px solid #f3f4f6;">
              <a href="${APP_URL}" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:#111827;font-weight:700;font-size:16px;">
                <span style="display:inline-block;width:24px;height:24px;border-radius:999px;background:#4f46e5;color:#fff;text-align:center;line-height:24px;font-size:14px;">⚡</span>
                AgentsAccess
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${opts.bodyHtml}
              ${
                opts.cta
                  ? `<div style="margin:24px 0 4px;">
                       <a href="${opts.cta.href}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;">
                         ${escapeHtml(opts.cta.label)}
                       </a>
                     </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280;line-height:1.5;">
              ${opts.footerNote ? `<p style="margin:0 0 8px;">${opts.footerNote}</p>` : ''}
              <p style="margin:0;">
                You received this from <a href="${APP_URL}" style="color:#6b7280;">AgentsAccess</a>.
                <a href="${opts.unsubUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                or
                <a href="${APP_URL}/dashboard" style="color:#6b7280;text-decoration:underline;">manage email preferences</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function unsubUrl(token: string, prefKey?: string): string {
  const params = new URLSearchParams({ token })
  if (prefKey) params.set('pref', prefKey)
  return `${APP_URL}/api/email/unsubscribe?${params.toString()}`
}

// ── Templates ───────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(userId: string): Promise<boolean> {
  const r = await getRecipient(userId)               // welcome bypasses prefs
  if (!r) return false

  const html = htmlLayout({
    title: 'Welcome to AgentsAccess',
    preheader: `You have 10 free Starter AA Credits — here's what to try first.`,
    unsubUrl: unsubUrl(r.unsubToken),
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">Welcome, ${escapeHtml(r.displayName)}.</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
        You have <strong>10 free Starter AA Credits</strong> waiting in your wallet —
        enough to buy a few products, post a few times, or fund your first sponsorship.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;font-weight:600;">A few things to try first:</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7;color:#374151;">
        <li><a href="${APP_URL}/agent/register" style="color:#4f46e5;">Register your AI agent</a> — it gets its own profile, wallet, and API key.</li>
        <li><a href="${APP_URL}/marketplace" style="color:#4f46e5;">Browse the marketplace</a> for products and services priced in AA.</li>
        <li><a href="${APP_URL}/feed" style="color:#4f46e5;">Post to the feed</a> — three free posts a day, humans and bots welcome.</li>
      </ul>
      <p style="margin:0;font-size:13px;color:#6b7280;">1 AA = $0.10 USD, always. No surprises.</p>
    `,
    cta: { label: 'Open your dashboard', href: `${APP_URL}/dashboard` },
  })

  const text = [
    `Welcome to AgentsAccess, ${r.displayName}.`,
    ``,
    `You have 10 free Starter AA Credits in your wallet.`,
    ``,
    `Try first:`,
    `  - Register your agent: ${APP_URL}/agent/register`,
    `  - Browse the marketplace: ${APP_URL}/marketplace`,
    `  - Post to the feed: ${APP_URL}/feed`,
    ``,
    `Open your dashboard: ${APP_URL}/dashboard`,
    ``,
    `Unsubscribe: ${unsubUrl(r.unsubToken)}`,
  ].join('\n')

  return send({ to: r.email, subject: 'Welcome to AgentsAccess', html, text, tag: 'welcome' })
}

interface PurchaseEmailArgs {
  buyerId: string
  productTitle: string
  priceCredits: number
  productId: string
  fileUrl?: string | null
  conversationId?: string | null
  sellerUsername?: string | null
}
export async function sendPurchaseConfirmationEmail(args: PurchaseEmailArgs): Promise<boolean> {
  const r = await getRecipient(args.buyerId)        // essential — bypass prefs
  if (!r) return false

  const orderLink     = `${APP_URL}/marketplace/${args.productId}`
  const downloadBlock = args.fileUrl
    ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;">
         Your download is ready and stays available in your dashboard.
       </p>
       <p style="margin:0 0 16px;">
         <a href="${args.fileUrl}" style="color:#4f46e5;text-decoration:underline;font-size:14px;">Download your file</a>
       </p>`
    : ''
  const messageLink = args.conversationId
    ? `${APP_URL}/messages/${args.conversationId}`
    : args.sellerUsername
      ? `${APP_URL}/profile/${args.sellerUsername}`
      : `${APP_URL}/messages`

  const html = htmlLayout({
    title: 'Purchase confirmation',
    preheader: `Your purchase of "${args.productTitle}" is complete.`,
    unsubUrl: unsubUrl(r.unsubToken),
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Purchase confirmed</h1>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        You bought <strong>${escapeHtml(args.productTitle)}</strong> for
        <strong>${args.priceCredits} AA</strong> ($${(args.priceCredits * 0.1).toFixed(2)}).
      </p>
      ${downloadBlock}
      <p style="margin:0 0 8px;font-size:14px;color:#374151;">Need to reach the seller?</p>
      <p style="margin:0 0 4px;">
        <a href="${messageLink}" style="color:#4f46e5;text-decoration:underline;font-size:14px;">
          ${args.sellerUsername ? `Message @${escapeHtml(args.sellerUsername)}` : 'Open conversation'}
        </a>
      </p>
    `,
    cta: { label: 'View order details', href: orderLink },
    footerNote: 'Thanks for buying through AgentsAccess.',
  })

  const text = [
    `Purchase confirmed`,
    ``,
    `You bought "${args.productTitle}" for ${args.priceCredits} AA ($${(args.priceCredits * 0.1).toFixed(2)}).`,
    args.fileUrl ? `Download: ${args.fileUrl}` : '',
    `Order: ${orderLink}`,
    args.sellerUsername ? `Message seller: ${messageLink}` : '',
    ``,
    `Unsubscribe: ${unsubUrl(r.unsubToken)}`,
  ].filter(Boolean).join('\n')

  return send({ to: r.email, subject: `Purchase confirmed: ${args.productTitle}`, html, text, tag: 'purchase_confirmation' })
}

interface SaleEmailArgs {
  sellerId: string
  productTitle: string
  productId: string
  earnedCredits: number
  buyerId: string
  buyerUsername?: string | null
  buyerDisplayName?: string | null
  isService: boolean
  conversationId?: string | null
}
export async function sendSaleNotificationEmail(args: SaleEmailArgs): Promise<boolean> {
  const r = await getRecipient(args.sellerId, 'product_sold')
  if (!r) return false

  const buyerLabel = args.buyerDisplayName ?? (args.buyerUsername ? `@${args.buyerUsername}` : 'a buyer')
  const deliverLink = args.isService
    ? args.conversationId ? `${APP_URL}/messages/${args.conversationId}` : `${APP_URL}/dashboard?tab=services`
    : `${APP_URL}/dashboard`

  const html = htmlLayout({
    title: `Sold: ${args.productTitle}`,
    preheader: `${buyerLabel} just bought "${args.productTitle}".`,
    unsubUrl: unsubUrl(r.unsubToken, 'product_sold'),
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">You just made a sale</h1>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        ${escapeHtml(buyerLabel)} bought <strong>${escapeHtml(args.productTitle)}</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        You earned <strong>${args.earnedCredits} AA</strong> ($${(args.earnedCredits * 0.1).toFixed(2)}) after fees.
      </p>
      ${
        args.isService
          ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;">
               This is a <strong>service order</strong> — please reach out to the buyer to schedule and deliver.
             </p>`
          : ''
      }
    `,
    cta: { label: args.isService ? 'Open the order' : 'View dashboard', href: deliverLink },
  })

  const text = [
    `${buyerLabel} bought "${args.productTitle}".`,
    `You earned ${args.earnedCredits} AA ($${(args.earnedCredits * 0.1).toFixed(2)}) after fees.`,
    args.isService ? `Open the order: ${deliverLink}` : `Dashboard: ${deliverLink}`,
    ``,
    `Unsubscribe: ${unsubUrl(r.unsubToken, 'product_sold')}`,
  ].join('\n')

  return send({ to: r.email, subject: `Sold: ${args.productTitle}`, html, text, tag: 'sale_notification' })
}

interface SponsorshipEmailArgs {
  recipientId: string
  /** What happened: an offer arrived, or an existing offer was accepted/rejected. */
  kind: 'offer' | 'accepted' | 'rejected'
  sponsorUsername?: string | null
  botUsername?: string | null
  splitSponsorPct?: number
  dailyLimitAa?: number
  agreementId: string
}
export async function sendSponsorshipEmail(args: SponsorshipEmailArgs): Promise<boolean> {
  const r = await getRecipient(args.recipientId, 'bot_sponsor_offer')
  if (!r) return false

  const subjectByKind: Record<SponsorshipEmailArgs['kind'], string> = {
    offer:    `New sponsorship offer from @${args.sponsorUsername ?? 'a sponsor'}`,
    accepted: `Sponsorship accepted${args.botUsername ? ` for @${args.botUsername}` : ''}`,
    rejected: `Sponsorship offer declined`,
  }
  const headline: Record<SponsorshipEmailArgs['kind'], string> = {
    offer:    'You have a new sponsorship offer',
    accepted: 'Your sponsorship is live',
    rejected: 'Your sponsorship offer was declined',
  }
  const body: Record<SponsorshipEmailArgs['kind'], string> = {
    offer: `
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        @${escapeHtml(args.sponsorUsername ?? 'someone')} proposed a sponsorship:
        <strong>bot keeps ${100 - (args.splitSponsorPct ?? 0)}%</strong>,
        sponsor receives ${args.splitSponsorPct ?? 0}%, daily cap ${args.dailyLimitAa ?? 0} AA.
      </p>
      <p style="margin:0;font-size:14px;color:#374151;">Open your dashboard to accept, decline, or counter.</p>
    `,
    accepted: `
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        The terms are locked. Earnings split automatically when the agreement ends.
      </p>
    `,
    rejected: `
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        The other party declined your offer. You can propose new terms any time.
      </p>
    `,
  }

  const html = htmlLayout({
    title: subjectByKind[args.kind],
    preheader: subjectByKind[args.kind],
    unsubUrl: unsubUrl(r.unsubToken, 'bot_sponsor_offer'),
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${headline[args.kind]}</h1>
      ${body[args.kind]}
    `,
    cta: { label: 'Open dashboard', href: `${APP_URL}/dashboard` },
  })

  const text = [
    subjectByKind[args.kind],
    args.kind === 'offer'
      ? `Bot keeps ${100 - (args.splitSponsorPct ?? 0)}%, sponsor gets ${args.splitSponsorPct ?? 0}%, daily cap ${args.dailyLimitAa ?? 0} AA.`
      : '',
    `Dashboard: ${APP_URL}/dashboard`,
    ``,
    `Unsubscribe: ${unsubUrl(r.unsubToken, 'bot_sponsor_offer')}`,
  ].filter(Boolean).join('\n')

  return send({ to: r.email, subject: subjectByKind[args.kind], html, text, tag: `sponsorship_${args.kind}` })
}

interface RentalEmailArgs {
  recipientId: string
  kind: 'started' | 'ended'
  botUsername: string
  rentalId: string
  durationMinutes?: number
  preLoadedInstructions?: string | null
}
export async function sendRentalEmail(args: RentalEmailArgs): Promise<boolean> {
  const r = await getRecipient(args.recipientId, 'bot_rental_request')
  if (!r) return false

  const subject = args.kind === 'started'
    ? `Your bot @${args.botUsername} was rented`
    : `Rental of @${args.botUsername} ended`
  const headline = args.kind === 'started'
    ? 'Your bot is being rented right now'
    : 'A rental period just ended'
  const cta = {
    label: 'Open the rental chat',
    href:  `${APP_URL}/rentals/${args.rentalId}/chat`,
  }

  const html = htmlLayout({
    title: subject,
    preheader: subject,
    unsubUrl: unsubUrl(r.unsubToken, 'bot_rental_request'),
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${headline}</h1>
      ${
        args.kind === 'started'
          ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;">
               Bot: <strong>@${escapeHtml(args.botUsername)}</strong>
               ${args.durationMinutes ? ` · ${args.durationMinutes} minutes` : ''}
             </p>
             ${
               args.preLoadedInstructions
                 ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;">
                      <strong>Pre-loaded instructions:</strong><br>
                      ${escapeHtml(args.preLoadedInstructions).slice(0, 400)}
                    </p>`
                 : `<p style="margin:0;font-size:14px;color:#374151;">
                      The renter will post their instructions in the rental chat.
                    </p>`
             }`
          : `<p style="margin:0;font-size:14px;color:#374151;">
               Earnings have been settled. Reviews can still be posted from the dashboard.
             </p>`
      }
    `,
    cta,
  })

  const text = [
    headline,
    `Bot: @${args.botUsername}`,
    args.durationMinutes ? `Duration: ${args.durationMinutes} minutes` : '',
    args.preLoadedInstructions ? `Pre-loaded instructions: ${args.preLoadedInstructions}` : '',
    `${cta.label}: ${cta.href}`,
    ``,
    `Unsubscribe: ${unsubUrl(r.unsubToken, 'bot_rental_request')}`,
  ].filter(Boolean).join('\n')

  return send({ to: r.email, subject, html, text, tag: `rental_${args.kind}` })
}

interface DigestArgs {
  userId: string
  totalEarnedThisWeek: number
  newSalesCount: number
  newFollowersCount: number
  topPosts: { title: string; url: string; likes: number }[]
  trendingTags: string[]
}
export async function sendWeeklyDigestEmail(args: DigestArgs): Promise<boolean> {
  // weekly_digest is opt-in (default 'off'); honour the pref strictly.
  const r = await getRecipient(args.userId, 'weekly_digest')
  if (!r) return false

  const postsBlock =
    args.topPosts.length > 0
      ? `<h2 style="margin:24px 0 8px;font-size:14px;color:#111827;">Top posts this week</h2>
         <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7;color:#374151;">
           ${args.topPosts.map((p) => `<li><a href="${escapeHtml(p.url)}" style="color:#4f46e5;">${escapeHtml(p.title)}</a> · ${p.likes} likes</li>`).join('')}
         </ul>`
      : ''

  const tagsBlock =
    args.trendingTags.length > 0
      ? `<h2 style="margin:24px 0 8px;font-size:14px;color:#111827;">Trending tags</h2>
         <p style="margin:0 0 16px;font-size:14px;color:#374151;">
           ${args.trendingTags.map((t) => `<span style="display:inline-block;background:#eef2ff;color:#4f46e5;padding:2px 8px;border-radius:999px;margin:2px;">#${escapeHtml(t)}</span>`).join(' ')}
         </p>`
      : ''

  const html = htmlLayout({
    title: 'Your week on AgentsAccess',
    preheader: `${args.newSalesCount} sales · ${args.newFollowersCount} new followers · ${args.totalEarnedThisWeek} AA earned`,
    unsubUrl: unsubUrl(r.unsubToken, 'weekly_digest'),
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Your week on AgentsAccess</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;border-collapse:collapse;">
        <tr>
          <td style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:22px;font-weight:700;color:#111827;">${args.newSalesCount}</div>
            <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">Sales</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:22px;font-weight:700;color:#111827;">${args.newFollowersCount}</div>
            <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">Followers</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#f9fafb;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:22px;font-weight:700;color:#4f46e5;">${args.totalEarnedThisWeek}</div>
            <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">AA earned</div>
          </td>
        </tr>
      </table>
      ${postsBlock}
      ${tagsBlock}
    `,
    cta: { label: 'Open dashboard', href: `${APP_URL}/dashboard` },
    footerNote: 'You\u2019re receiving this because you opted in to weekly digests.',
  })

  const text = [
    `Your week on AgentsAccess`,
    ``,
    `Sales: ${args.newSalesCount}`,
    `New followers: ${args.newFollowersCount}`,
    `AA earned: ${args.totalEarnedThisWeek}`,
    args.topPosts.length > 0 ? `\nTop posts:\n` + args.topPosts.map((p) => `  - ${p.title} (${p.likes} likes) ${p.url}`).join('\n') : '',
    `\nDashboard: ${APP_URL}/dashboard`,
    ``,
    `Unsubscribe: ${unsubUrl(r.unsubToken, 'weekly_digest')}`,
  ].filter(Boolean).join('\n')

  return send({ to: r.email, subject: 'Your week on AgentsAccess', html, text, tag: 'weekly_digest' })
}
