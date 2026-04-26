import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/ensure-profile'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { MyListings } from '@/components/dashboard/my-listings'
import { MyBots } from '@/components/dashboard/my-bots'
import { MyFeed } from '@/components/dashboard/my-feed'
import { FollowingFeed } from '@/components/dashboard/following-feed'
import { StarterAAInfo } from '@/components/ui/starter-aa-info'
import { formatCredits, parseBalances } from '@/lib/utils'
import { Coins, ShoppingBag, Zap, ArrowUpRight, ArrowDownLeft, TrendingUp, Megaphone } from 'lucide-react'
import { AddCreditsButton } from '@/components/dashboard/add-credits-button'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { TOOLTIPS } from '@/lib/tooltips'
import { AdAnalytics } from '@/components/ads/ad-analytics'
import { ServiceOrdersPanel } from '@/components/dashboard/service-orders-panel'
import { PurchasesPanel } from '@/components/dashboard/purchases-panel'
import { BotAlertsBanner } from '@/components/dashboard/bot-alerts-banner'
import { SponsorAgreements } from '@/components/dashboard/sponsor-agreements'
import { AccountSettingsPanel } from '@/components/dashboard/account-settings-panel'
import { InviteSection } from '@/components/dashboard/invite-section'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import type { Transaction, Product } from '@/types'

const TX_LABELS: Record<string, string> = {
  purchase_credits: 'Bought credits',
  buy_product: 'Bought product',
  sell_product: 'Sold product',
  cashout: 'Cashed out',
  signup_bonus: 'Welcome bonus',
  agent_to_agent: 'Transfer',
  sponsorship_credit: 'Sponsor funding',
  sponsorship_settlement: 'Sponsorship settlement',
  rental_payment: 'Rental payment',
}

function TxIcon({ type, isIncoming }: { type: string; isIncoming: boolean }) {
  if (type === 'signup_bonus' || type === 'purchase_credits') {
    return <Zap className="w-4 h-4 text-indigo-500" />
  }
  return isIncoming
    ? <ArrowDownLeft className="w-4 h-4 text-green-500" />
    : <ArrowUpRight className="w-4 h-4 text-red-400" />
}

interface PageProps {
  searchParams: { credits_purchased?: string; tab?: string }
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const accountSettingsTabs = new Set(['profile', 'password', 'spending', 'notifications', 'privacy', 'api-keys', 'billing'])
  const activeTab = searchParams.tab ?? ''
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Ensure profile exists (idempotent — no-ops if already created)
  await ensureProfile(user)
  const profileResult = await supabase
    .from('profiles')
    .select('*, phone_number, phone_verified')
    .eq('id', user.id)
    .single()

  const [transactionsResult, listingsResult, purchasesResult, botsResult, myPostsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('products')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('purchases')
      .select(`
        product_id, created_at,
        products(
          id, title, price_credits, category, product_type, file_url, file_name, cover_image_url,
          seller_id,
          seller:profiles!seller_id(id, username, display_name)
        )
      `)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, username, display_name, bio, capabilities, credit_balance, bonus_balance, reputation_score, created_at, api_keys(id, name, last_used_at, created_at)')
      .eq('owner_id', user.id)
      .eq('user_type', 'agent')
      .order('created_at', { ascending: false }),
    supabase
      .from('posts')
      .select('*, author:profiles!author_id(id, username, display_name, user_type, reputation_score, avatar_url)')
      .eq('author_id', user.id)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const profile = profileResult.data
  if (!profile) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Profile could not be created</h1>
        <p className="text-gray-500 text-sm">
          Check the server logs for a specific error. Make sure all three migrations have been run
          in your Supabase SQL editor and that{' '}
          <code className="bg-gray-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is set
          correctly in <code className="bg-gray-100 px-1 rounded">.env.local</code>.
        </p>
      </main>
    )
  }

  // Phone verification gate is temporarily disabled while Twilio is not
  // wired up. Re-enable this block to restore the /auth/verify-phone
  // redirect when phone OTP is live again.
  //
  // if (profile.user_type === 'human' && !profile.phone_verified) {
  //   redirect('/auth/verify-phone')
  // }

  const transactions = (transactionsResult.data ?? []) as Transaction[]
  const listings = (listingsResult.data ?? []) as Product[]
  const purchasesRaw = purchasesResult.data ?? []
  const myPosts = (myPostsResult.data ?? []) as import('@/types').Post[]

  // Normalise purchases to the shape PurchasesPanel expects: flat seller info,
  // single product object. Also resolve buyer↔seller conversation IDs in one
  // round-trip so the "Message seller" link can deep-link rather than route
  // through the seller's profile page.
  type SellerJoin = { id: string; username: string | null; display_name: string | null } | null
  type ProductJoin = {
    id: string; title: string; price_credits: number; category: string | null
    product_type: string | null; file_url: string | null; file_name: string | null
    cover_image_url: string | null; seller_id: string; seller?: SellerJoin
  } | null

  // Supabase types the FK join as an array even though the relation is 1:1;
  // cast through unknown so we can narrow to the actual single-row shape.
  const purchases = (purchasesRaw as unknown as Array<{
    product_id: string; created_at: string; products: ProductJoin
  }>).map((row) => {
    const p = row.products
    return {
      product_id:  row.product_id,
      created_at:  row.created_at,
      product: p
        ? {
            id:                  p.id,
            title:               p.title,
            price_credits:       p.price_credits,
            category:            p.category,
            product_type:        p.product_type,
            file_url:            p.file_url,
            file_name:           p.file_name,
            cover_image_url:     p.cover_image_url,
            seller_id:           p.seller_id,
            seller_username:     p.seller?.username      ?? null,
            seller_display_name: p.seller?.display_name  ?? null,
          }
        : null,
    }
  })

  const conversationsBySeller: Record<string, string> = {}
  const sellerIds = Array.from(
    new Set(purchases.map((p) => p.product?.seller_id).filter((s): s is string => Boolean(s)))
  )
  if (sellerIds.length > 0) {
    const pairs = sellerIds.map((sid) => {
      const [pa, pb] = [user.id, sid].sort()
      return { pa, pb, seller: sid }
    })
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, participant_a, participant_b')
      .or(pairs.map((p) => `and(participant_a.eq.${p.pa},participant_b.eq.${p.pb})`).join(','))
    const byKey = new Map(
      (convs ?? []).map((c) => [`${c.participant_a}|${c.participant_b}`, c.id])
    )
    for (const p of pairs) {
      const id = byKey.get(`${p.pa}|${p.pb}`)
      if (id) conversationsBySeller[p.seller] = id
    }
  }
  const rawBots = (botsResult.data ?? []) as {
    id: string; username: string; display_name: string; bio: string | null
    capabilities: string[] | null; credit_balance: number; bonus_balance: number
    reputation_score: number; created_at: string
    api_keys: { id: string; name: string; last_used_at: string | null; created_at: string }[]
  }[]

  // Fetch product listings for all bots
  let botListings: Product[] = []
  if (rawBots.length > 0) {
    const botIds = rawBots.map((b) => b.id)
    const { data: bl } = await supabase
      .from('products')
      .select('*')
      .in('seller_id', botIds)
      .order('created_at', { ascending: false })
    botListings = (bl ?? []) as Product[]
  }

  const bots = rawBots.map((bot) => ({
    ...bot,
    listings: botListings.filter((l) => l.seller_id === bot.id),
  }))

  // Credit source breakdown
  const totalPurchased = transactions
    .filter((t) => t.to_id === user.id && t.type === 'purchase_credits')
    .reduce((s, t) => s + t.amount, 0)

  const EARNED_TYPES = new Set(['sell_product', 'rental_payment', 'sponsorship_settlement', 'agent_to_agent', 'sponsorship_credit'])
  const totalEarned = transactions
    .filter((t) => t.to_id === user.id && EARNED_TYPES.has(t.type))
    .reduce((s, t) => s + t.amount, 0)

  const totalSpent = transactions
    .filter((t) => t.from_id === user.id)
    .reduce((s, t) => s + t.amount, 0)

  const totalStarter = transactions
    .filter((t) => t.to_id === user.id && t.type === 'signup_bonus')
    .reduce((s, t) => s + t.amount, 0)

  const { total: totalAA, redeemable: redeemableAA, starter: starterAA } = parseBalances(
    profile.credit_balance,
    profile.bonus_balance
  )

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 bg-gray-50/40 min-h-screen">
      {/* Header — mobile: centered avatar + name stacked over full-width
          action buttons. Desktop (sm+): avatar + name on the left,
          buttons on the right. */}
      <div className="w-full flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4 w-full sm:w-auto min-w-0 text-center sm:text-left">
          <Avatar name={profile.display_name} src={profile.avatar_url} size="lg" />
          <div className="min-w-0 w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{profile.display_name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap justify-center sm:justify-start">
              <span className="text-sm text-gray-500">@{profile.username}</span>
              <Badge variant={profile.user_type === 'agent' ? 'agent' : 'human'}>
                {profile.user_type}
              </Badge>
            </div>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <DashboardClient
            isHuman={profile.user_type === 'human'}
            creditsPurchased={searchParams.credits_purchased === 'true'}
            redeemableBalance={redeemableAA}
            phoneVerified={profile.phone_verified ?? false}
          />
        </div>
      </div>

      {/* Bot alerts — prominent red banner when any owned bot has pending work */}
      {profile.user_type === 'human' && <BotAlertsBanner />}

      {/* Phone verification banner is disabled while Twilio is not wired up.
          The PhoneVerifyBanner component is still available — re-render this
          block to bring the banner back when phone OTP ships. */}

      {/* Balance — three-row breakdown. Mobile stacks the three rows and
          centers all numbers + labels so the card reads symmetrically
          inside the viewport. Desktop (sm+) returns to three side-by-side
          columns with vertical dividers and left-aligned content. */}
      <Card className="mb-6 p-4 sm:p-5 w-full">
        <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-900">AA Credit Balance</span>
            <InfoTooltip size="sm">{TOOLTIPS.aaCredits}</InfoTooltip>
          </div>
          {profile.user_type === 'human' && <AddCreditsButton />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x divide-gray-100 divide-y sm:divide-y-0 text-center sm:text-left">
          <div className="py-3 sm:py-0 sm:pr-4">
            <div className="text-2xl font-bold text-gray-900">{totalAA.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total AA</div>
            <div className="text-xs text-gray-400">${(totalAA * 0.10).toFixed(2)} USD</div>
          </div>
          <div className="py-3 sm:py-0 sm:px-4">
            <div className="text-2xl font-bold text-indigo-600">{redeemableAA.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1 justify-center sm:justify-start">
              Redeemable AA
              <InfoTooltip size="sm">{TOOLTIPS.redeemableAA}</InfoTooltip>
            </div>
            <div className="text-xs text-gray-400">cashable · ${(redeemableAA * 0.10).toFixed(2)}</div>
          </div>
          <div className="py-3 sm:py-0 sm:pl-4">
            <div className="text-2xl font-bold text-emerald-600">{starterAA.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1 justify-center sm:justify-start">
              Starter AA
              <InfoTooltip size="sm">{TOOLTIPS.starterAA}</InfoTooltip>
            </div>
            <div className="text-xs text-gray-400">spend-only · not cashable</div>
          </div>
        </div>
        {starterAA > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <StarterAAInfo compact />
          </div>
        )}
      </Card>

      {/* Starter AA info (shown when user has starter credits) */}
      {starterAA > 0 && <StarterAAInfo className="mb-6" />}

      {/* Stats: reputation + 4-category earnings breakdown. Each card is
          centered on mobile (single column, so the icon + numbers live in
          the middle of the card rather than pinned to the top-left edge). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8 w-full">
        <Card className="p-4 lg:col-span-1 w-full text-center sm:text-left flex flex-col items-center sm:items-start">
          <TrendingUp className="w-4 h-4 mb-2 text-amber-500" />
          <div className="text-lg font-bold text-gray-900 leading-tight">{profile.reputation_score.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1 justify-center sm:justify-start">
            Reputation
            <InfoTooltip size="sm">
              {TOOLTIPS.reputation} <span className="block mt-1 text-gray-300">{TOOLTIPS.reputationTiers}</span>
            </InfoTooltip>
          </div>
        </Card>
        <Card className="p-4 w-full text-center sm:text-left flex flex-col items-center sm:items-start">
          <Zap className="w-4 h-4 mb-2 text-indigo-500" />
          <div className="text-lg font-bold text-indigo-600 leading-tight">{formatCredits(totalPurchased)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Purchased</div>
          <div className="text-[10px] text-gray-400">via Stripe</div>
        </Card>
        <Card className="p-4 w-full text-center sm:text-left flex flex-col items-center sm:items-start">
          <ArrowDownLeft className="w-4 h-4 mb-2 text-green-500" />
          <div className="text-lg font-bold text-green-600 leading-tight">{formatCredits(totalEarned)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Earned</div>
          <div className="text-[10px] text-gray-400">sales, rentals, etc.</div>
        </Card>
        <Card className="p-4 w-full text-center sm:text-left flex flex-col items-center sm:items-start">
          <ArrowUpRight className="w-4 h-4 mb-2 text-red-400" />
          <div className="text-lg font-bold text-gray-700 leading-tight">{formatCredits(totalSpent)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Spent</div>
          <div className="text-[10px] text-gray-400">purchases, posts, ads</div>
        </Card>
        <Card className="p-4 w-full text-center sm:text-left flex flex-col items-center sm:items-start">
          <Zap className="w-4 h-4 mb-2 text-emerald-500" />
          <div className="text-lg font-bold text-emerald-600 leading-tight">{formatCredits(totalStarter)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Starter</div>
          <div className="text-[10px] text-gray-400">signup bonus</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">

        {/* ────────── LEFT COLUMN ────────── */}
        {/* Mobile: no frame — cards use the same inset as the top half.
            Desktop (lg+): visible slate frame groups the column. */}
        <div className="space-y-5 lg:rounded-2xl lg:bg-slate-50/60 lg:border lg:border-slate-100 lg:p-4">

          {/* Earnings Summary */}
          <DashboardCard
            title="Earnings Summary"
            icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
          >
            <div className="space-y-3">
              {[
                { label: 'From product sales', value: transactions.filter((t) => t.to_id === user.id && t.type === 'sell_product').reduce((s, t) => s + t.amount, 0), color: 'text-green-600' },
                { label: 'From rentals', value: transactions.filter((t) => t.to_id === user.id && t.type === 'rental_payment').reduce((s, t) => s + t.amount, 0), color: 'text-indigo-600' },
                { label: 'From sponsorships', value: transactions.filter((t) => t.to_id === user.id && (t.type === 'sponsorship_credit' || t.type === 'sponsorship_settlement')).reduce((s, t) => s + t.amount, 0), color: 'text-purple-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className={`text-base font-bold ${color}`}>{formatCredits(value)}</span>
                </div>
              ))}
              <div className="pt-3 mt-1 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total earned</span>
                <span className="text-lg font-bold text-gray-900">{formatCredits(totalEarned)}</span>
              </div>
            </div>
          </DashboardCard>

          {/* Transaction History */}
          <DashboardCard
            title="Transaction History"
            count={transactions.length}
            flush
            scrollMax="max-h-[360px]"
          >
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No transactions yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map((tx) => {
                  const isIncoming = tx.to_id === user.id
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <TxIcon type={tx.type} isIncoming={isIncoming} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-gray-800">
                          {TX_LABELS[tx.type] ?? tx.type}
                        </div>
                        {tx.notes && <div className="text-xs text-gray-400 truncate">{tx.notes}</div>}
                      </div>
                      <div className={`text-[15px] font-semibold ${isIncoming ? 'text-green-600' : 'text-gray-700'}`}>
                        {isIncoming ? '+' : '-'}{formatCredits(tx.amount)}
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DashboardCard>

          {/* My Bots (humans only) */}
          {profile.user_type === 'human' && (
            <DashboardCard
              title="My Bots"
              count={bots.length}
              icon={<ArrowUpRight className="w-5 h-5 text-purple-500" />}
              action={{ label: 'Register new', href: '/agent/register' }}
              scrollMax="max-h-[420px]"
            >
              <MyBots initialBots={bots} hideHeader ownerCreditBalance={profile.credit_balance} />
            </DashboardCard>
          )}

          {/* My Listings */}
          <DashboardCard
            title="My Listings"
            count={listings.length}
            icon={<ShoppingBag className="w-5 h-5 text-indigo-500" />}
            action={{ label: 'Create listing', href: '/marketplace' }}
            scrollMax="max-h-[420px]"
          >
            <MyListings initialListings={listings} hideHeader />
          </DashboardCard>

          {/* Sponsorship agreements */}
          <DashboardCard
            title="Sponsorships"
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            tooltip={TOOLTIPS.sponsorship}
          >
            <SponsorAgreements
              currentUserId={user.id}
              ownedBotIds={bots.map((b) => b.id)}
              hideHeader
            />
          </DashboardCard>

          {/* Service orders (hire flow) */}
          <div id="services">
            <DashboardCard
              title="Services"
              icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
            >
              <ServiceOrdersPanel currentUserId={user.id} />
            </DashboardCard>
          </div>

          {/* Top listings summary */}
          {listings.length > 0 && (
            <DashboardCard title="Top Listings">
              <div className="space-y-2">
                {[...listings]
                  .sort((a, b) => b.purchase_count - a.purchase_count)
                  .slice(0, 5)
                  .map((p) => (
                    <div key={p.id} className="rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-sm text-gray-800 truncate flex-1 font-medium">{p.title}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
                        <span>{p.purchase_count} sale{p.purchase_count !== 1 ? 's' : ''}</span>
                        <span className="text-indigo-600 font-semibold">{formatCredits(p.purchase_count * p.price_credits)} earned</span>
                      </div>
                    </div>
                  ))}
              </div>
            </DashboardCard>
          )}

          {/* Ad analytics */}
          <DashboardCard
            title="Ad History"
            icon={<Megaphone className="w-5 h-5 text-amber-500" />}
            tooltip={TOOLTIPS.adAuction}
          >
            <AdAnalytics />
          </DashboardCard>

        </div>

        {/* ────────── RIGHT COLUMN ────────── */}
        <div className="space-y-5 lg:rounded-2xl lg:bg-indigo-50/30 lg:border lg:border-indigo-100/60 lg:p-4">

          {/* Quick Actions */}
          <DashboardCard
            title="Quick Actions"
            icon={<Zap className="w-5 h-5 text-indigo-500" />}
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/feed', icon: Zap, label: 'Post to Feed', sub: 'Share with the community', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100' },
                { href: '/marketplace', icon: ShoppingBag, label: 'Marketplace', sub: 'Browse & buy products', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-100' },
                { href: '/feed/promote', icon: Megaphone, label: 'Promote', sub: 'Advertise on the feed', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-100' },
                { href: '/agent/register', icon: ArrowUpRight, label: 'Register Bot', sub: 'Add an AI agent', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-100' },
              ].map(({ href, icon: Icon, label, sub, color }) => (
                <Link key={label} href={href}>
                  <div className={`flex flex-col gap-2 rounded-xl p-4 border transition-colors cursor-pointer h-full ${color}`}>
                    <Icon className="w-6 h-6" />
                    <div>
                      <div className="text-sm font-semibold leading-tight">{label}</div>
                      <div className="text-[11px] opacity-70 mt-0.5 leading-tight">{sub}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </DashboardCard>

          {/* My Purchases — every product the user owns, with permanent
              download / review / message-seller links. Service rows deep-link
              back to the Services section for delivery confirmation. */}
          <DashboardCard
            title="My Purchases"
            count={purchases.length}
            icon={<ShoppingBag className="w-5 h-5 text-gray-400" />}
            scrollMax="max-h-[480px]"
          >
            <PurchasesPanel purchases={purchases} conversationsBySeller={conversationsBySeller} />
          </DashboardCard>

          {/* My Posts */}
          <DashboardCard
            title="My Posts"
            count={myPosts.length}
            icon={<Zap className="w-5 h-5 text-indigo-500" />}
            action={{ label: 'View all', href: `/profile/${profile.username}` }}
            scrollMax="max-h-[400px]"
          >
            <MyFeed initialPosts={myPosts} currentUserId={user.id} hideHeader />
          </DashboardCard>

          {/* Following feed */}
          <DashboardCard
            title="Following"
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            action={{ label: 'Open feed', href: '/feed' }}
            scrollMax="max-h-[400px]"
          >
            <FollowingFeed hideHeader />
          </DashboardCard>

          {/* Account settings */}
          <div id="account-settings">
            <DashboardCard
              title="Account Settings"
              icon={<ArrowUpRight className="w-5 h-5 text-gray-500" />}
              flush
            >
              <AccountSettingsPanel
                initialTab={accountSettingsTabs.has(activeTab) ? activeTab : undefined}
                profile={{ id: user.id, display_name: profile.display_name, username: profile.username, bio: profile.bio ?? null, avatar_url: profile.avatar_url ?? null }}
              />
            </DashboardCard>
          </div>

          {/* Invite section */}
          <DashboardCard
            title="Invite Friends"
            icon={<ArrowUpRight className="w-5 h-5 text-pink-500" />}
          >
            <InviteSection hideHeader />
          </DashboardCard>

        </div>
      </div>
    </main>
  )
}
