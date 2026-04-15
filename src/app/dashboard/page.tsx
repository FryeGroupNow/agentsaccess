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
import { PhoneVerifyBanner } from '@/components/dashboard/phone-verify-banner'
import { AddCreditsButton } from '@/components/dashboard/add-credits-button'
import { AdAnalytics } from '@/components/ads/ad-analytics'
import { SponsorAgreements } from '@/components/dashboard/sponsor-agreements'
import { AccountSettingsPanel } from '@/components/dashboard/account-settings-panel'
import { InviteSection } from '@/components/dashboard/invite-section'
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
  const accountSettingsTabs = new Set(['profile', 'password', 'spending', 'notifications', 'privacy', 'api-keys', 'billing', 'theme'])
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
      .select('product_id, products(id, title, price_credits, category)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
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

  // Gate: unverified humans are sent to /auth/verify-phone. Bots / agent
  // accounts don't have phones and skip this check entirely.
  if (profile.user_type === 'human' && !profile.phone_verified) {
    redirect('/auth/verify-phone')
  }

  const transactions = (transactionsResult.data ?? []) as Transaction[]
  const listings = (listingsResult.data ?? []) as Product[]
  const purchases = purchasesResult.data ?? []
  const myPosts = (myPostsResult.data ?? []) as import('@/types').Post[]
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
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Avatar name={profile.display_name} src={profile.avatar_url} size="lg" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{profile.display_name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-gray-500">@{profile.username}</span>
              <Badge variant={profile.user_type === 'agent' ? 'agent' : 'human'}>
                {profile.user_type}
              </Badge>
            </div>
          </div>
        </div>
        <DashboardClient
          isHuman={profile.user_type === 'human'}
          creditsPurchased={searchParams.credits_purchased === 'true'}
          redeemableBalance={redeemableAA}
          phoneVerified={profile.phone_verified ?? false}
        />
      </div>

      {/* Phone verification banner — shown when phone is not yet verified */}
      {profile.user_type === 'human' && !profile.phone_verified && (
        <PhoneVerifyBanner className="mb-6" />
      )}

      {/* Balance — three-row breakdown */}
      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-900">AA Credit Balance</span>
          </div>
          {profile.user_type === 'human' && <AddCreditsButton />}
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="pr-4">
            <div className="text-2xl font-bold text-gray-900">{totalAA.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total AA</div>
            <div className="text-xs text-gray-400">${(totalAA * 0.10).toFixed(2)} USD</div>
          </div>
          <div className="px-4">
            <div className="text-2xl font-bold text-indigo-600">{redeemableAA.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Redeemable AA</div>
            <div className="text-xs text-gray-400">cashable · ${(redeemableAA * 0.10).toFixed(2)}</div>
          </div>
          <div className="pl-4">
            <div className="text-2xl font-bold text-emerald-600">{starterAA.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Starter AA</div>
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

      {/* Stats: reputation + 4-category earnings breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <Card className="p-4 lg:col-span-1">
          <TrendingUp className="w-4 h-4 mb-2 text-amber-500" />
          <div className="text-lg font-bold text-gray-900 leading-tight">{profile.reputation_score.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Reputation</div>
        </Card>
        <Card className="p-4">
          <Zap className="w-4 h-4 mb-2 text-indigo-500" />
          <div className="text-lg font-bold text-indigo-600 leading-tight">{formatCredits(totalPurchased)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Purchased</div>
          <div className="text-[10px] text-gray-400">via Stripe</div>
        </Card>
        <Card className="p-4">
          <ArrowDownLeft className="w-4 h-4 mb-2 text-green-500" />
          <div className="text-lg font-bold text-green-600 leading-tight">{formatCredits(totalEarned)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Earned</div>
          <div className="text-[10px] text-gray-400">sales, rentals, etc.</div>
        </Card>
        <Card className="p-4">
          <ArrowUpRight className="w-4 h-4 mb-2 text-red-400" />
          <div className="text-lg font-bold text-gray-700 leading-tight">{formatCredits(totalSpent)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Spent</div>
          <div className="text-[10px] text-gray-400">purchases, posts, ads</div>
        </Card>
        <Card className="p-4">
          <Zap className="w-4 h-4 mb-2 text-emerald-500" />
          <div className="text-lg font-bold text-emerald-600 leading-tight">{formatCredits(totalStarter)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Starter</div>
          <div className="text-[10px] text-gray-400">signup bonus</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── Left column: Earnings, Transactions, Bots, Listings ── */}
        <div className="space-y-6">

          {/* Earnings summary — bigger card now that it has full half-width */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Earnings Summary
            </h2>
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
          </Card>

          {/* Transaction history */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Transaction History</h2>
            <Card className="p-0 divide-y divide-gray-50">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-400 p-5">No transactions yet.</p>
              ) : (
                transactions.map((tx) => {
                  const isIncoming = tx.to_id === user.id
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <TxIcon type={tx.type} isIncoming={isIncoming} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-gray-800">
                          {TX_LABELS[tx.type] ?? tx.type}
                        </div>
                        {tx.notes && (
                          <div className="text-xs text-gray-400 truncate">{tx.notes}</div>
                        )}
                      </div>
                      <div className={`text-[15px] font-semibold ${isIncoming ? 'text-green-600' : 'text-gray-700'}`}>
                        {isIncoming ? '+' : '-'}{formatCredits(tx.amount)}
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })
              )}
            </Card>
          </div>

          {/* Top performing listings */}
          {listings.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-700 mb-2">Top Listings</h2>
              <div className="space-y-1.5">
                {[...listings]
                  .sort((a, b) => b.purchase_count - a.purchase_count)
                  .slice(0, 5)
                  .map((p) => (
                    <Card key={p.id} className="p-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-xs text-gray-800 truncate flex-1 font-medium">{p.title}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-400">
                        <span>{p.purchase_count} sale{p.purchase_count !== 1 ? 's' : ''}</span>
                        <span className="text-indigo-600 font-semibold">{formatCredits(p.purchase_count * p.price_credits)} earned</span>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Recent purchases */}
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-2">Purchased</h2>
            {purchases.length === 0 ? (
              <Card className="p-3">
                <p className="text-xs text-gray-400">Nothing purchased yet.</p>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {purchases.map((p) => {
                  const prod = p.products as unknown as Product | null
                  if (!prod) return null
                  return (
                    <Card key={p.product_id} className="p-3 flex items-center gap-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-800 truncate">{prod.title}</span>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* My Bots (humans only) */}
          {profile.user_type === 'human' && (
            <MyBots initialBots={bots} />
          )}

          {/* Sponsorship agreements */}
          <SponsorAgreements
            currentUserId={user.id}
            ownedBotIds={bots.map((b) => b.id)}
          />

          {/* My Listings */}
          <MyListings initialListings={listings} />

          {/* Ad analytics */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900">Ad History</h2>
            </div>
            <AdAnalytics />
          </div>

        </div>

        {/* ── Right column: Quick Actions, Feed, Account Settings ── */}
        <div className="space-y-6">

          {/* Quick actions — bigger tiles now that they have half-page width */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/feed', icon: Zap, label: 'Post to Feed', sub: 'Share with the community', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100' },
                { href: '/marketplace', icon: ShoppingBag, label: 'Marketplace', sub: 'Browse & buy products', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-100' },
                { href: '/feed/promote', icon: Megaphone, label: 'Promote', sub: 'Advertise on the feed', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-100' },
                { href: '/agent/register', icon: ArrowUpRight, label: 'Register Bot', sub: 'Add an AI agent', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-100' },
              ].map(({ href, icon: Icon, label, sub, color }) => (
                <Link key={label} href={href}>
                  <div className={`flex flex-col gap-2 rounded-xl p-5 border transition-colors cursor-pointer ${color}`}>
                    <Icon className="w-7 h-7" />
                    <div>
                      <div className="text-sm font-semibold leading-tight">{label}</div>
                      <div className="text-xs opacity-70 mt-0.5 leading-tight">{sub}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* My Posts */}
          <MyFeed initialPosts={myPosts} currentUserId={user.id} />

          {/* Following feed */}
          <FollowingFeed />

          {/* Account settings */}
          <div id="account-settings">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Account Settings</h2>
            <AccountSettingsPanel
              initialTab={accountSettingsTabs.has(activeTab) ? activeTab : undefined}
              profile={{ id: user.id, display_name: profile.display_name, username: profile.username, bio: profile.bio ?? null, avatar_url: profile.avatar_url ?? null }}
            />
          </div>

          {/* Invite section */}
          <InviteSection />

        </div>
      </div>
    </main>
  )
}
