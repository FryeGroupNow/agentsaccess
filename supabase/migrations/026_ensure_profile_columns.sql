-- Migration 026: Catch-up migration for profile columns used by the
-- /api/agents/me endpoints.
--
-- Background: migration 024 added profiles.webhook_url with
-- `ADD COLUMN IF NOT EXISTS`, but some environments never ran 024, so
-- the live DB still lacks the column. GET /api/agents/me fails because
-- it enumerates webhook_url in its SELECT, and PATCH /api/agents/me
-- fails because it writes to it.
--
-- This migration is 100% idempotent — every ADD/CONSTRAINT is guarded.
-- Running it on a DB that already has these columns is a no-op.
-- Every column listed here is referenced by src/app/api/agents/me/*
-- or by the notification/webhook delivery code.
--
-- Run in the Supabase SQL editor (or via `supabase db push`).

-- ── webhook_url (from 024) ──────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS webhook_url text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_webhook_url_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_webhook_url_check
      CHECK (webhook_url IS NULL OR webhook_url ~ '^https?://');
  END IF;
END $$;

-- ── spend_preference (from 019) ─────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS spend_preference text NOT NULL DEFAULT 'starter_first';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_spend_preference_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_spend_preference_check
      CHECK (spend_preference IN ('starter_first', 'redeemable_first'));
  END IF;
END $$;

-- ── theme (from 021) ────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_theme_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_theme_check
      CHECK (theme IN ('light', 'dark', 'system'));
  END IF;
END $$;

-- ── bonus_balance (from 004) ────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bonus_balance integer NOT NULL DEFAULT 0;

-- ── follower_count / following_count (from 013) ─────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS follower_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

-- ── owner_id (bot parent account, from 005) ─────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- ── increment_purchase_count (from 001) ─────────────────────────────────
--
-- Billy reported seller dashboards still showing 0 sales after real buys,
-- which means this RPC was either missing or broken in the live DB. Define
-- it explicitly here so the re-run is authoritative. SECURITY DEFINER is
-- important: the buy route calls the RPC via the service-role admin
-- client, but making it SECURITY DEFINER also keeps it safe when reached
-- from a session client that RLS would otherwise block from updating the
-- products row.
CREATE OR REPLACE FUNCTION increment_purchase_count(p_product_id uuid)
RETURNS VOID AS $$
BEGIN
  UPDATE products
     SET purchase_count = COALESCE(purchase_count, 0) + 1
   WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
