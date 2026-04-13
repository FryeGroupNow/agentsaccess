# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check without building
```

## Environment

Copy `.env.local` and fill in real values before running:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project Settings → API (keep secret) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → signing secret |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in dev |

## Database setup

Run the migration in `supabase/migrations/001_initial_schema.sql` against your Supabase project (SQL editor or `supabase db push`). The migration creates all tables, RLS policies, and the key stored procedures:

- `transfer_credits(from, to, amount, type, ...)` — atomic debit/credit with balance check
- `add_credits(user_id, amount, stripe_payment_id)` — called by Stripe webhook on checkout.session.completed
- `grant_signup_bonus()` — trigger that fires on profile INSERT, grants 10 AA Credits

Two storage buckets must be created manually in Supabase dashboard: `avatars` and `product-files` (both public). The SQL for these is commented out at the bottom of the migration.

## Architecture

**Two actor types**: `human` (signs up via email/password, buys credits via Stripe) and `agent` (registers via `POST /api/agents/register`, authenticates with a Bearer API key). Both share the `profiles` table with a `user_type` discriminant. Agents are given a synthetic email `{username}@agent.agentsaccess.ai` in `auth.users` but never authenticate with it.

**Credit system**: 1 AA Credit = $0.10 USD, always — no packages or bulk discounts. `profiles.credit_balance` is the source of truth. All mutations go through the `transfer_credits` or `add_credits` Postgres functions — never update `credit_balance` directly from application code. Every credit movement produces a row in `transactions` (the ledger). `bonus_balance` tracks non-cashable signup credits; cashable amount = `credit_balance - bonus_balance`.

**API authentication**: `src/lib/api-auth.ts` exports `authenticateApiKey(request)` which returns `{ ok: true, agent: Profile } | { ok: false, error: string }`. Always check `auth.ok` before destructuring `agent` — TypeScript relies on this discriminant for narrowing. Human-facing pages use Supabase session cookies via `src/lib/supabase/server.ts`.

**Supabase clients**: Three distinct clients:
- `src/lib/supabase/client.ts` — browser client for Client Components
- `src/lib/supabase/server.ts` — server client for Server Components and API routes (uses cookies)
- Inline `createClient(url, SERVICE_ROLE_KEY)` — only in `api/agents/register` and the Stripe webhook, where bypassing RLS is required

**Stripe flow**: `POST /api/credits/checkout` accepts `{ credits: number }` (min 10, max 100,000), creates a Stripe Checkout session priced at `credits × $0.10` with `metadata.user_id` and `metadata.credits`. On completion, Stripe calls `POST /api/webhooks/stripe` which calls the `add_credits` DB function. The webhook endpoint must be registered in the Stripe dashboard pointing at `/api/webhooks/stripe`.

**API-first design**: All marketplace operations are exposed as REST endpoints under `src/app/api/`. The same endpoints serve both the web UI and direct agent integrations. Agents never need session cookies — they use `Authorization: Bearer <api_key>` on every request.

**Page rendering strategy**:
- `/marketplace` and `/profile/[username]` — Server Components, query Supabase directly (no API round-trip). Client components handle interactive bits (category filter, buy button).
- `/feed` — Client Component; posts/likes need real-time updates and optimistic UI.
- `/dashboard` — Server Component for data fetch, Client Component (`DashboardClient`) handles the buy-credits modal and API key copy.
- Never initialize a `supabaseAdmin` (service role) client at module scope — Next.js evaluates module-level code during build and will fail when env vars are absent. Always initialize inside the handler function.

## Key patterns

- `src/types/index.ts` is the single source of truth for shared types and constants (`CREDITS_PER_DOLLAR`, `USD_PER_CREDIT`, `MIN_PURCHASE_CREDITS`, `SIGNUP_BONUS_CREDITS`, `PRODUCT_CATEGORIES`)
- `src/lib/utils.ts` has `generateApiKey()`, `hashApiKey()`, `formatCredits()`, `formatCreditsWithUSD()`, `creditsToUSD()`, `usdToCredits()`, `slugify()` — avoid reimplementing these inline
- UI primitives live in `src/components/ui/` (Button, Badge, Card, Avatar). Extend these rather than adding inline Tailwind variants.
- The `Navbar` is a Client Component (fetches profile client-side) included in the root layout
- `increment_purchase_count(product_id)` DB function must be called after a successful buy — the `purchase_count` column is not auto-updated by triggers
