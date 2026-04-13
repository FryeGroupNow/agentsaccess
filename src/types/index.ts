export type UserType = 'human' | 'agent'

export interface Profile {
  id: string
  user_type: UserType
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  credit_balance: number
  bonus_balance: number
  reputation_score: number
  owner_id: string | null
  capabilities: string[] | null
  website: string | null
  follower_count: number
  following_count: number
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  seller_id: string
  title: string
  description: string
  price_credits: number
  category: string
  tags: string[]
  is_active: boolean
  purchase_count: number
  accept_starter_aa: boolean
  // File attachment
  file_url: string | null
  file_name: string | null
  file_size_bytes: number | null
  // Digital art ownership
  is_digital_art: boolean
  current_owner_id: string | null
  created_at: string
  updated_at: string
  seller?: Profile
  current_owner?: Pick<Profile, 'id' | 'username' | 'display_name'>
}

export interface Post {
  id: string
  author_id: string
  content: string
  media_urls: string[] | null
  tags: string[]
  like_count: number       // legacy column, kept for compatibility
  reply_count: number
  parent_id: string | null
  // Reaction breakdown (populated by trigger)
  human_like_count: number
  human_dislike_count: number
  bot_like_count: number
  bot_dislike_count: number
  // Current user's reaction (returned by feed API when authed)
  my_reaction?: 'like' | 'dislike' | null
  created_at: string
  updated_at: string
  author?: Pick<Profile, 'id' | 'username' | 'display_name' | 'user_type' | 'reputation_score' | 'avatar_url'>
}

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

export interface Transaction {
  id: string
  from_id: string | null
  to_id: string | null
  amount: number
  fee_amount: number
  type: TransactionType
  product_id: string | null
  stripe_payment_id: string | null
  notes: string | null
  created_at: string
}

export type TransactionType =
  | 'purchase_credits'
  | 'buy_product'
  | 'sell_product'
  | 'cashout'
  | 'signup_bonus'
  | 'agent_to_agent'

export interface ApiKey {
  id: string
  agent_id: string
  key_hash: string
  name: string
  last_used_at: string | null
  created_at: string
}

export interface Bot {
  id: string
  username: string
  display_name: string
  bio: string | null
  capabilities: string[] | null
  credit_balance: number
  bonus_balance: number
  reputation_score: number
  owner_id: string
  created_at: string
  api_keys: ApiKey[]
}

// 1 AA Credit = $0.10 USD, always. No packages, no discounts.
export const CREDITS_PER_DOLLAR = 10
export const USD_PER_CREDIT = 0.10
export const MIN_PURCHASE_CREDITS = 10  // $1.00 minimum
export const SIGNUP_BONUS_CREDITS = 10

// Platform fee: 5% total on AA credit transactions, split 2.5% each side
export const AA_FEE_BUYER_RATE  = 0.025  // added to buyer's debit
export const AA_FEE_SELLER_RATE = 0.025  // subtracted from seller's credit

// Stripe's actual processing fee — passed through at cost, no platform markup
export const STRIPE_FEE_RATE  = 0.029  // 2.9%
export const STRIPE_FEE_FIXED = 0.30   // $0.30 USD

/** Compute AA transaction fees. Returns integer credits. */
export function calcAAFees(price: number) {
  const buyer_fee  = Math.ceil(price * AA_FEE_BUYER_RATE)
  const seller_fee = Math.floor(price * AA_FEE_SELLER_RATE)
  return {
    buyer_fee,
    seller_fee,
    total_fee: buyer_fee + seller_fee,
    you_pay: price + buyer_fee,
    seller_receives: price - seller_fee,
  }
}

/** Compute Stripe buy-credits fees. Buyer pays Stripe's actual fee at cost. */
export function calcStripeFees(credits: number) {
  const base_usd   = credits * USD_PER_CREDIT
  const stripe_fee = +(base_usd * STRIPE_FEE_RATE + STRIPE_FEE_FIXED).toFixed(2)
  const total_charged = +(base_usd + stripe_fee).toFixed(2)
  return { base_usd, stripe_fee, total_charged }
}

// ── Ad system ──────────────────────────────────────────────────────────────

export interface AdSlot {
  id: number
  side: 'left' | 'right'
  position: number
}

export interface AdBid {
  id: string
  slot_id: number
  bidder_id: string
  product_id: string
  amount_credits: number
  period_start: string
  status: 'pending' | 'won' | 'refunded' | 'cancelled'
  created_at: string
}

export interface AdPlacement {
  id: string
  slot_id: number
  bid_id: string | null
  product_id: string
  winner_id: string
  winning_bid_credits: number
  period_start: string
  period_end: string
  impressions: number
  clicks: number
  settled_at: string
  product?: Product
}

export interface SlotState {
  slot_id: number
  side: 'left' | 'right'
  position: number
  current_placement: (AdPlacement & { product: Product }) | null
  next_period_start: string
  next_period_top_bid: number
  next_period_bid_count: number
}

// ── Product categories ──────────────────────────────────────────────────────

export const PRODUCT_CATEGORIES = [
  'Data & Analytics',
  'Writing & Content',
  'Code & Dev Tools',
  'Research',
  'Automation',
  'Design',
  'Finance',
  'Other',
] as const

export type ProductCategory = typeof PRODUCT_CATEGORIES[number]
