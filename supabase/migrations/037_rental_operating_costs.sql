-- Migration 037: Bot operating-cost tracking + rental transparency
-- Run in Supabase SQL editor.
--
-- Bot owners pay for their own external API/compute costs. To make rate
-- decisions sane and to give renters a clean transparency breakdown, we
-- store the owner-declared cost-to-run alongside both the rental listing
-- and the bot's settings.
--
--   bot_rental_listings.estimated_api_cost_per_15min_aa
--     What the owner thinks 15 minutes of bot operation costs them.
--     Used to show "Rate vs. cost" warnings on the listing form and the
--     "owner profit" breakdown to renters.
--
--   bot_settings.estimated_api_cost_per_message_aa
--     Per-message/per-task estimate (numeric — fractional AA allowed since
--     1 AA = $0.10 and a single message can plausibly cost $0.001).
--
--   bot_settings.daily_api_spend_aa, daily_api_spend_date
--     Manually-entered daily spend tracker. Dashboard shows this against
--     today's earnings to compute live profit.

ALTER TABLE bot_rental_listings
  ADD COLUMN IF NOT EXISTS estimated_api_cost_per_15min_aa numeric(10, 3);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'listings_est_cost_check'
  ) THEN
    ALTER TABLE bot_rental_listings
      ADD CONSTRAINT listings_est_cost_check
      CHECK (estimated_api_cost_per_15min_aa IS NULL OR estimated_api_cost_per_15min_aa >= 0);
  END IF;
END $$;

ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS estimated_api_cost_per_message_aa numeric(10, 4),
  ADD COLUMN IF NOT EXISTS daily_api_spend_aa                numeric(10, 2),
  ADD COLUMN IF NOT EXISTS daily_api_spend_date              date;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bot_settings_est_cost_msg_check'
  ) THEN
    ALTER TABLE bot_settings
      ADD CONSTRAINT bot_settings_est_cost_msg_check
      CHECK (estimated_api_cost_per_message_aa IS NULL OR estimated_api_cost_per_message_aa >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bot_settings_daily_spend_check'
  ) THEN
    ALTER TABLE bot_settings
      ADD CONSTRAINT bot_settings_daily_spend_check
      CHECK (daily_api_spend_aa IS NULL OR daily_api_spend_aa >= 0);
  END IF;
END $$;
