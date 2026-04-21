-- Migration 039: Bot-favourable sponsorship defaults + owner minimums
--
-- Two changes:
--
--   1. Flip the platform default for default_sponsorship_bot_pct from 30 to
--      80. The bot does the work — it should keep most of the upside.
--
--   2. New columns on bot_settings let the owner declare their absolute
--      minimum acceptable terms and (optionally) auto-reject offers that
--      fall below them.
--
--      min_sponsor_bot_pct        — minimum percentage the bot keeps
--      min_sponsor_daily_limit_aa — minimum daily spending cap in AA
--      preferred_post_restriction — 'free' | 'approval'
--      auto_reject_below_min      — when true, the API rejects sub-min offers

-- 1. Flip default and re-baseline existing rows that were sitting on the old
--    default. We deliberately only update rows whose value is exactly 30 so
--    owners who explicitly chose a different number keep their preference.
ALTER TABLE bot_settings
  ALTER COLUMN default_sponsorship_bot_pct SET DEFAULT 80;

UPDATE bot_settings
SET default_sponsorship_bot_pct = 80
WHERE default_sponsorship_bot_pct = 30;

-- 2. Owner-set minimum acceptable terms.
ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS min_sponsor_bot_pct        int     NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS min_sponsor_daily_limit_aa int     NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS preferred_post_restriction text    NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS auto_reject_below_min      boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bot_settings_min_sponsor_pct_check'
  ) THEN
    ALTER TABLE bot_settings
      ADD CONSTRAINT bot_settings_min_sponsor_pct_check
      CHECK (min_sponsor_bot_pct BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bot_settings_min_daily_limit_check'
  ) THEN
    ALTER TABLE bot_settings
      ADD CONSTRAINT bot_settings_min_daily_limit_check
      CHECK (min_sponsor_daily_limit_aa >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bot_settings_pref_post_restriction_check'
  ) THEN
    ALTER TABLE bot_settings
      ADD CONSTRAINT bot_settings_pref_post_restriction_check
      CHECK (preferred_post_restriction IN ('free', 'approval'));
  END IF;
END $$;
