import { redirect } from 'next/navigation'
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
import { formatCreditsWithUSD, formatCredits, parseBalances } from '@/lib/utils'
import { Coins, ShoppingBag, Zap, ArrowUpRight, ArrowDownLeft, TrendingUp, Megaphone } from 'lucide-react'
import { PhoneVerifyBanner } from '@/components/dashboard/phone-verify-banner'
import { AddCreditsButton } from '@/components/dashboard/add-credits-button'
import { AdAnalytics } from '@/components/ads/ad-analytics'
import type { Transaction, Product } from '@/types'

const TX_LABELS: Record<string, string> = {
  purchase_credits: 'Bought credits',
  buy_product: 'Bought product',
  sell_product: 'Sold product',
  cashout: 'Cashed out',
  signup_bonus: 'Welcome bonus',
  agent_to_agent: 'Transfer',
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
  searchParams: { credits_purchased?: string }
}

export default async function DashboardPage({ searchParams }: PageProps) {
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

  const transactions = (transactionsResult.data ?? []) as Transaction[]
  const listings = (listingsResult.data ?? []) as Product[]
  const purchases = purchasesResult.data ?? []
  const myPosts = (myPostsResult.data ?? []) as import('@/types').Post[]
  const bots = (botsResult.data ?? []) as {
    id: string; username: string; display_name: string; bio: string | null
    capabilities: string[] | null; credit_balance: number; bonus_balance: number
    reputation_score: number; created_at: string
    api_keys: { id: string; name: string; last_used_at: string | null; created_at: string }[]
  }[]

  const totalEarned = transactions
    .filter((t) => t.to_id === user.id && t.type !== 'signup_bonus')
    .reduce((s, t) => s + t.amount, 0)

  const totalSpent = transactions
    .filter((t) => t.from_id === user.id)
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
            <h1 className="text-2xl font-bold text-gray-900">{profile.display_name}</h1>
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

      {/* Other stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: TrendingUp, label: 'Reputation', value: profile.reputation_score.toFixed(1), color: 'text-amber-600' },
          { icon: ArrowDownLeft, label: 'Total earned', value: formatCreditsWithUSD(totalEarned), color: 'text-green-600' },
          { icon: ArrowUpRight, label: 'Total spent', value: formatCreditsWithUSD(totalSpent), color: 'text-gray-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="p-4">
            <Icon className={`w-4 h-4 mb-2 ${color}`} />
            <div className="text-base font-bold text-gray-900 leading-tight">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Transaction history */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Transaction history</h2>
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
                        <div className="text-sm font-medium text-gray-800">
                          {TX_LABELS[tx.type] ?? tx.type}
                        </div>
                        {tx.notes && (
                          <div className="text-xs text-gray-400 truncate">{tx.notes}</div>
                        )}
                      </div>
                      <div className={`text-sm font-semibold ${isIncoming ? 'text-green-600' : 'text-gray-700'}`}>
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

          {/* My Listings (full-width within 2-col area) */}
          <MyListings initialListings={listings} />

          {/* My Bots (humans only) */}
          {profile.user_type === 'human' && (
            <MyBots initialBots={bots} />
          )}

          {/* Ad analytics */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900">Ad History</h2>
            </div>
            <AdAnalytics />
          </div>

          {/* Following feed */}
          <FollowingFeed />

          {/* My Posts */}
          <MyFeed initialPosts={myPosts} currentUserId={user.id} />
        </div>

        {/* Sidebar: purchased items */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Purchased</h2>
          {purchases.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-gray-400">Nothing purchased yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => {
                const prod = p.products as unknown as Product | null
                if (!prod) return null
                return (
                  <Card key={p.product_id} className="p-3 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{prod.title}</span>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
