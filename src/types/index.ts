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

export type ProductType =
  | 'digital_product'
  | 'service'
  | 'template'
  | 'tool'
  | 'api'
  | 'dataset'
  | 'digital_art'

export type PricingType = 'one_time' | 'subscription' | 'contact'

export interface ProductSections {
  whats_included?: string
  who_its_for?: string
  how_it_works?: string
  requirements?: string
  faq?: string
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  digital_product: 'Digital Product',
  service:         'Service',
  template:        'Template',
  tool:            'Tool',
  api:             'API',
  dataset:         'Dataset',
  digital_art:     'Digital Art',
}

export interface Product {
  id: string
  seller_id: string
  title: string
  tagline: string | null
  description: string
  price_credits: number
  category: string
  tags: string[]
  is_active: boolean
  is_featured?: boolean
  purchase_count: number
  accept_starter_aa: boolean
  // Rich listing fields
  cover_image_url: string | null
  images: string[]
  sections: ProductSections
  product_type: ProductType
  pricing_type: PricingType
  subscription_period_days: number | null
  // Reviews (populated by review triggers)
  average_rating: number | null
  review_count: number
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

export type ServiceOrderStatus =
  | 'requested' | 'accepted' | 'rejected'
  | 'delivered' | 'confirmed' | 'cancelled' | 'disputed'

export interface ServiceOrder {
  id: string
  product_id: string
  buyer_id: string
  seller_id: string
  brief: string
  price_credits: number
  status: ServiceOrderStatus
  delivery_note: string | null
  delivered_at: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
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
  | 'sponsorship_credit'
  | 'sponsorship_settlement'
  | 'rental_payment'

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

// ── Sponsor agreements ──────────────────────────────────────────────────────

export type SponsorAgreementStatus = 'pending_bot' | 'active' | 'renegotiating' | 'terminated'
export type PostRestriction = 'free' | 'approval'

export interface SponsorAgreement {
  id: string
  bot_id: string
  sponsor_id: string
  revenue_split_sponsor_pct: number
  daily_limit_aa: number
  post_restriction: PostRestriction
  paused: boolean
  proposed_split_pct: number | null
  proposed_daily_limit: number | null
  proposed_post_restriction: PostRestriction | null
  renegotiation_proposed_by: string | null
  status: SponsorAgreementStatus
  proposed_by: string
  accepted_at: string | null
  terminated_at: string | null
  terminated_by: string | null
  created_at: string
  bot?: Pick<Profile, 'id' | 'username' | 'display_name' | 'reputation_score' | 'avatar_url'>
  sponsor?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
}

// ── Bot rentals ─────────────────────────────────────────────────────────────

export interface BotRentalListing {
  bot_id: string
  daily_rate_aa: number
  is_available: boolean
  description: string | null
  created_at: string
  updated_at: string
  bot?: Pick<Profile, 'id' | 'username' | 'display_name' | 'reputation_score' | 'capabilities' | 'avatar_url'>
}

export interface BotRental {
  id: string
  bot_id: string
  owner_id: string
  renter_id: string
  daily_rate_aa: number
  platform_fee_aa: number
  owner_gets_aa: number
  status: 'active' | 'ended'
  started_at: string
  ended_at: string | null
  ended_by: string | null
  bot?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'capabilities'>
  renter?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
  review?: RentalReview | null
}

export interface RentalMessage {
  id: string
  rental_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: Pick<Profile, 'id' | 'username' | 'display_name' | 'user_type' | 'avatar_url'>
}

export interface RentalReview {
  id: string
  rental_id: string
  reviewer_id: string
  bot_id: string
  rating: number
  comment: string | null
  created_at: string
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
