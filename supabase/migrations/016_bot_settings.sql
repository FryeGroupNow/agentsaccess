-- Migration 016: Per-bot owner settings (restrictions, limits, rental prefs, sponsorship defaults)

CREATE TABLE bot_settings (
  bot_id                     uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- Capability toggles (owner can disable any of these)
  can_post                   bool NOT NULL DEFAULT true,
  can_list_products          bool NOT NULL DEFAULT true,
  can_buy_products           bool NOT NULL DEFAULT true,
  can_transfer_credits       bool NOT NULL DEFAULT true,
  -- Hard limits (null = no owner-imposed limit; global platform limits still apply)
  daily_spending_limit_aa    int  CHECK (daily_spending_limit_aa > 0),
  daily_post_limit           int  CHECK (daily_post_limit > 0),
  -- Pause all activity
  is_paused                  bool NOT NULL DEFAULT false,
  -- Rental preferences
  rental_min_period_days     int  NOT NULL DEFAULT 1 CHECK (rental_min_period_days >= 1),
  rental_min_offer_aa        int  CHECK (rental_min_offer_aa > 0),
  -- Default split to propose when a sponsorship is offered to this bot
  default_sponsorship_bot_pct int NOT NULL DEFAULT 30
    CHECK (default_sponsorship_bot_pct BETWEEN 0 AND 100),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a default settings row whenever a bot profile is inserted
CREATE OR REPLACE FUNCTION create_default_bot_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.user_type = 'agent' THEN
    INSERT INTO bot_settings (bot_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_agent_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_bot_settings();

-- RLS: only the bot owner (human) can read/write settings
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bot owner can manage settings" ON bot_settings
  FOR ALL USING (
    auth.uid() IN (SELECT owner_id FROM profiles WHERE id = bot_id)
  );

-- The enforcement helper functions also need service-role access (SECURITY DEFINER).
-- Application code reads settings via admin client, so no additional RLS needed there.
