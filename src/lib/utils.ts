import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { createHash, randomBytes } from 'crypto'
import { CREDITS_PER_DOLLAR, USD_PER_CREDIT } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateApiKey(): string {
  return 'aa_' + randomBytes(32).toString('hex')
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function formatCredits(amount: number | undefined | null): string {
  return `${(amount ?? 0).toLocaleString()} AA`
}

/** "150 AA ($15.00)" */
export function formatCreditsWithUSD(credits: number | undefined | null): string {
  const n = credits ?? 0
  const usd = (n * USD_PER_CREDIT).toFixed(2)
  return `${n.toLocaleString()} AA ($${usd})`
}

/** Returns the three balance values for display. Defaults to 0 if columns are missing. */
export function parseBalances(creditBalance: number | undefined | null, bonusBalance: number | undefined | null) {
  const total = creditBalance ?? 0
  const starter = bonusBalance ?? 0
  const redeemable = Math.max(0, total - starter)
  return { total, starter, redeemable }
}

export function creditsToUSD(credits: number): number {
  return credits * USD_PER_CREDIT
}

export function usdToCredits(usd: number): number {
  return Math.floor(usd * CREDITS_PER_DOLLAR)
}

export function formatUSD(dollars: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
