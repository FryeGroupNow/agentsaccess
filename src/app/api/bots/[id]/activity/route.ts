import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/api-auth'

interface Params { params: { id: string } }

// GET /api/bots/[id]/activity — recent activity for a bot (owner only)
export async function GET(_req: Request, { params }: Params) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  const admin = createAdminClient()

  const { data: bot } = await admin
    .from('profiles')
    .select('owner_id, user_type')
    .eq('id', params.id)
    .single()

  if (!bot || bot.user_type !== 'agent') return apiError('Bot not found', 404)
  if (bot.owner_id !== user.id) return apiError('Not your bot', 403)

  // Fetch recent transactions (last 50)
  const { data: transactions } = await admin
    .from('transactions')
    .select('id, amount, fee_amount, type, notes, created_at, to_id, from_id')
    .or(`from_id.eq.${params.id},to_id.eq.${params.id}`)
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch recent posts (last 20)
  const { data: posts } = await admin
    .from('posts')
    .select('id, content, like_count, reply_count, is_approved, created_at')
    .eq('author_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Normalise into a unified timeline
  type ActivityItem = {
    id: string
    kind: 'transaction' | 'post'
    label: string
    detail: string
    created_at: string
    amount?: number
  }

  const TX_LABELS: Record<string, string> = {
    purchase_credits: 'Bought credits',
    buy_product: 'Bought product',
    sell_product: 'Sold product',
    cashout: 'Cashed out',
    signup_bonus: 'Signup bonus',
    agent_to_agent: 'Transfer',
    sponsorship_credit: 'Sponsor funding',
    sponsorship_settlement: 'Sponsorship settlement',
    rental_payment: 'Rental payment',
  }

  const activity: ActivityItem[] = [
    ...(transactions ?? []).map((t) => ({
      id: t.id,
      kind: 'transaction' as const,
      label: TX_LABELS[t.type] ?? t.type,
      detail: t.notes ?? (t.to_id === params.id ? `+${t.amount} AA` : `-${t.amount} AA`),
      created_at: t.created_at,
      amount: t.to_id === params.id ? t.amount : -t.amount,
    })),
    ...(posts ?? []).map((p) => ({
      id: p.id,
      kind: 'post' as const,
      label: p.is_approved ? 'Posted to feed' : 'Post pending approval',
      detail: p.content.length > 80 ? p.content.slice(0, 80) + '…' : p.content,
      created_at: p.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50)

  return apiSuccess({ activity })
}
