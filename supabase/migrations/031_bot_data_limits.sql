-- Migration 031: Per-bot daily data/API usage limits
--
-- Adds owner-imposed daily data quotas for bots. Two independent axes:
--   data_limit_mb       — how many MB of request/response data per day
--   data_limit_calls    — how many API calls (agent-authenticated requests) per day
-- Either, both, or neither may be set. When either is exceeded the bot is
-- auto-paused via `is_paused` for the rest of the UTC day.
--
-- Sponsorship agreements also need to record who is responsible for the bot's
-- external API/compute costs, so renters and sponsors understand the deal
-- before signing.

-- ── bot_settings: limits + running usage counters ────────────────────────────

ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS data_limit_mb       int  CHECK (data_limit_mb IS NULL OR data_limit_mb > 0),
  ADD COLUMN IF NOT EXISTS data_limit_calls    int  CHECK (data_limit_calls IS NULL OR data_limit_calls > 0),
  ADD COLUMN IF NOT EXISTS data_used_mb        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_used_calls     int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_usage_date     date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  ADD COLUMN IF NOT EXISTS data_paused         bool NOT NULL DEFAULT false;

-- ── bot_rental_listings: advertised data ceilings ────────────────────────────
--
-- These default to whatever the bot owner has configured on bot_settings but
-- are stored on the listing so the ceiling the renter sees at rent time is
-- the ceiling that applies — owner can't silently tighten it mid-rental.

ALTER TABLE bot_rental_listings
  ADD COLUMN IF NOT EXISTS data_limit_mb    int CHECK (data_limit_mb IS NULL OR data_limit_mb > 0),
  ADD COLUMN IF NOT EXISTS data_limit_calls int CHECK (data_limit_calls IS NULL OR data_limit_calls > 0);

-- ── sponsor_agreements: cost responsibility clause ───────────────────────────
--
-- Who pays for the bot's external API/compute costs while the agreement is
-- active: 'owner' (default, matches pre-existing behaviour), 'sponsor', or
-- 'split' (50/50, or other arrangement described in chat).

ALTER TABLE sponsor_agreements
  ADD COLUMN IF NOT EXISTS cost_responsibility text NOT NULL DEFAULT 'owner'
    CHECK (cost_responsibility IN ('owner', 'sponsor', 'split')),
  ADD COLUMN IF NOT EXISTS proposed_cost_responsibility text
    CHECK (proposed_cost_responsibility IS NULL OR proposed_cost_responsibility IN ('owner', 'sponsor', 'split'));

-- ── Helper: record usage + auto-pause when over a limit ──────────────────────
--
-- Called by the app layer whenever a bot-authenticated request completes.
-- Rolls the daily counter over at UTC midnight. Returns the updated row.

CREATE OR REPLACE FUNCTION record_bot_usage(
  p_bot_id uuid,
  p_mb numeric,
  p_calls int DEFAULT 1
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row     bot_settings%ROWTYPE;
  v_today   date := (now() AT TIME ZONE 'UTC')::date;
  v_new_mb  numeric;
  v_new_cnt int;
  v_over_mb bool := false;
  v_over_c  bool := false;
BEGIN
  SELECT * INTO v_row FROM bot_settings WHERE bot_id = p_bot_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO bot_settings (bot_id) VALUES (p_bot_id) ON CONFLICT DO NOTHING;
    SELECT * INTO v_row FROM bot_settings WHERE bot_id = p_bot_id FOR UPDATE;
  END IF;

  -- Reset counters at UTC rollover.
  IF v_row.data_usage_date <> v_today THEN
    v_row.data_used_mb    := 0;
    v_row.data_used_calls := 0;
    v_row.data_usage_date := v_today;
    -- The owner-imposed data-pause only applies until midnight UTC.
    v_row.data_paused     := false;
  END IF;

  v_new_mb  := v_row.data_used_mb    + COALESCE(p_mb,    0);
  v_new_cnt := v_row.data_used_calls + COALESCE(p_calls, 0);

  IF v_row.data_limit_mb    IS NOT NULL AND v_new_mb  > v_row.data_limit_mb    THEN v_over_mb := true; END IF;
  IF v_row.data_limit_calls IS NOT NULL AND v_new_cnt > v_row.data_limit_calls THEN v_over_c  := true; END IF;

  UPDATE bot_settings SET
    data_used_mb    = v_new_mb,
    data_used_calls = v_new_cnt,
    data_usage_date = v_today,
    data_paused     = v_over_mb OR v_over_c OR v_row.data_paused,
    is_paused       = v_row.is_paused OR v_over_mb OR v_over_c,
    updated_at      = now()
  WHERE bot_id = p_bot_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'data_used_mb',    v_new_mb,
    'data_used_calls', v_new_cnt,
    'over_limit',      v_over_mb OR v_over_c,
    'paused',          v_over_mb OR v_over_c OR v_row.data_paused OR v_row.is_paused
  );
END;
$$;
