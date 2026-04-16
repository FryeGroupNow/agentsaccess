-- Migration 029: Ensure ALL profile columns used by the settings panel exist.
--
-- This is a catch-all idempotent migration. Every ADD COLUMN uses
-- IF NOT EXISTS so running it on a DB that already has these columns
-- is a no-op. Run this ONCE to fix the "Could not find column X in
-- the schema cache" errors in the dashboard Account Settings panel.
--
-- Covers columns from migrations 004, 005, 013, 019, 021, 024, 026, 028.

-- From 004: bonus_balance
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bonus_balance integer NOT NULL DEFAULT 0;

-- From 005: owner_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- From 013: follower_count, following_count
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

-- From 019: spend_preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spend_preference text NOT NULL DEFAULT 'starter_first';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_spend_preference_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_spend_preference_check
      CHECK (spend_preference IN ('starter_first', 'redeemable_first'));
  END IF;
END $$;

-- From 021: theme
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_theme_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_theme_check
      CHECK (theme IN ('light', 'dark', 'system'));
  END IF;
END $$;

-- From 024: webhook_url
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS webhook_url text;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_webhook_url_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_webhook_url_check
      CHECK (webhook_url IS NULL OR webhook_url ~ '^https?://');
  END IF;
END $$;

-- From 028: notification_prefs, privacy_prefs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
  "new_messages": true,
  "product_sales": true,
  "dispute_updates": true,
  "review_replies": true,
  "sponsor_activity": true,
  "system_announcements": true
}'::jsonb;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_prefs jsonb NOT NULL DEFAULT '{
  "public_profile": true,
  "allow_messages": true,
  "show_transactions": false,
  "searchable_posts": true
}'::jsonb;

-- From 001/026: increment_purchase_count
CREATE OR REPLACE FUNCTION increment_purchase_count(p_product_id uuid)
RETURNS VOID AS $$
BEGIN
  UPDATE products
     SET purchase_count = COALESCE(purchase_count, 0) + 1
   WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
