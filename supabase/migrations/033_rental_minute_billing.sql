-- Migration 033: Minute-based rental billing
--
-- The old model charged one day upfront and had no notion of "time remaining".
-- The new model:
--   • owners set BOTH a 15-minute rate and a daily rate
--   • renters pick a duration (15m / 30m / 1h / 2h / 4h / 8h / 1d / custom)
--   • cost = min(blocks_15 × per_15, full_days × per_day + remainder × per_15)
--   • rentals have an expires_at; once past it (and not extended), they end
--   • renters can extend at any time for more 15-minute blocks
--   • platform still keeps a 5% fee on every rental payment
--
-- We intentionally keep bot_rental_listings.daily_rate_aa so existing listings
-- don't blow up; we add rate_per_15min_aa alongside. A backfill sets a
-- sensible default (daily_rate / 96, minimum 1) for existing rows.

-- ── Listings: add per-15-minute rate ─────────────────────────────────────────

ALTER TABLE bot_rental_listings
  ADD COLUMN IF NOT EXISTS rate_per_15min_aa int CHECK (rate_per_15min_aa IS NULL OR rate_per_15min_aa > 0);

-- Backfill: if null, 1/96th of the daily rate (min 1).
UPDATE bot_rental_listings
SET rate_per_15min_aa = GREATEST(1, CEIL(daily_rate_aa::numeric / 96))
WHERE rate_per_15min_aa IS NULL;

-- From here on the column must be populated.
ALTER TABLE bot_rental_listings
  ALTER COLUMN rate_per_15min_aa SET NOT NULL;

-- ── Rentals: track duration + expiry + snapshot rates ────────────────────────

ALTER TABLE bot_rentals
  ADD COLUMN IF NOT EXISTS rate_per_15min_aa int,
  ADD COLUMN IF NOT EXISTS expires_at        timestamptz,
  ADD COLUMN IF NOT EXISTS total_minutes     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid_aa     int NOT NULL DEFAULT 0;

-- Backfill: treat legacy rentals as 1-day bookings that paid the daily_rate.
UPDATE bot_rentals SET
  rate_per_15min_aa = GREATEST(1, CEIL(daily_rate_aa::numeric / 96)),
  expires_at        = COALESCE(expires_at, started_at + interval '1 day'),
  total_minutes     = GREATEST(total_minutes, 1440),
  total_paid_aa     = GREATEST(total_paid_aa, daily_rate_aa)
WHERE rate_per_15min_aa IS NULL OR expires_at IS NULL;

ALTER TABLE bot_rentals
  ALTER COLUMN rate_per_15min_aa SET NOT NULL,
  ALTER COLUMN expires_at        SET NOT NULL;

CREATE INDEX IF NOT EXISTS bot_rentals_expires_idx
  ON bot_rentals (expires_at)
  WHERE status = 'active';

-- ── Cost helper ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_rental_cost(
  p_minutes int,
  p_rate_15 int,
  p_rate_day int
) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_blocks    int;
  v_full_days int;
  v_remainder int;
  v_cost_15   int;
  v_cost_mix  int;
BEGIN
  IF p_minutes <= 0 THEN RETURN 0; END IF;
  v_blocks    := CEIL(p_minutes::numeric / 15)::int;
  v_full_days := v_blocks / 96;                   -- integer division
  v_remainder := v_blocks - v_full_days * 96;
  v_cost_15   := v_blocks * p_rate_15;
  v_cost_mix  := v_full_days * p_rate_day + v_remainder * p_rate_15;
  RETURN LEAST(v_cost_15, v_cost_mix);
END;
$$;

-- ── start_rental: replaces the old day-only version ──────────────────────────

CREATE OR REPLACE FUNCTION start_rental(
  p_bot_id uuid,
  p_renter_id uuid,
  p_minutes int DEFAULT 15
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_listing    bot_rental_listings%ROWTYPE;
  v_bot        profiles%ROWTYPE;
  v_renter     profiles%ROWTYPE;
  v_owner_id   uuid;
  v_cost       int;
  v_fee        int;
  v_owner_gets int;
  v_rental_id  uuid;
BEGIN
  IF p_minutes IS NULL OR p_minutes < 15 THEN
    RETURN '{"error":"Minimum rental is 15 minutes"}'::jsonb;
  END IF;

  SELECT * INTO v_listing FROM bot_rental_listings WHERE bot_id = p_bot_id FOR UPDATE;
  IF NOT FOUND OR NOT v_listing.is_available THEN
    RETURN '{"error":"Bot is not available for rent"}'::jsonb;
  END IF;

  SELECT * INTO v_bot FROM profiles WHERE id = p_bot_id;
  IF v_bot.reputation_score < 5 THEN
    RETURN '{"error":"Bot does not meet minimum reputation score"}'::jsonb;
  END IF;

  v_owner_id := v_bot.owner_id;
  IF v_owner_id IS NULL THEN RETURN '{"error":"Bot has no owner"}'::jsonb; END IF;
  IF v_owner_id = p_renter_id THEN RETURN '{"error":"Cannot rent your own bot"}'::jsonb; END IF;

  IF EXISTS (SELECT 1 FROM bot_rentals WHERE bot_id = p_bot_id AND status = 'active') THEN
    RETURN '{"error":"Bot already has an active rental"}'::jsonb;
  END IF;

  SELECT * INTO v_renter FROM profiles WHERE id = p_renter_id;

  v_cost       := compute_rental_cost(p_minutes, v_listing.rate_per_15min_aa, v_listing.daily_rate_aa);
  v_fee        := CEIL(v_cost * 0.05)::int;
  v_owner_gets := v_cost - v_fee;

  IF v_renter.credit_balance < v_cost THEN
    RETURN jsonb_build_object('error', 'Insufficient credits', 'needed', v_cost);
  END IF;

  UPDATE profiles SET credit_balance = credit_balance - v_cost        WHERE id = p_renter_id;
  UPDATE profiles SET credit_balance = credit_balance + v_owner_gets   WHERE id = v_owner_id;

  INSERT INTO transactions (from_id, to_id, amount, fee_amount, type, notes)
  VALUES (p_renter_id, v_owner_id, v_cost, v_fee,
          'rental_payment', format('Bot rental: @%s (%s min)', v_bot.username, p_minutes));

  INSERT INTO bot_rentals (
    bot_id, owner_id, renter_id,
    daily_rate_aa, rate_per_15min_aa,
    platform_fee_aa, owner_gets_aa,
    total_minutes, total_paid_aa,
    expires_at
  )
  VALUES (
    p_bot_id, v_owner_id, p_renter_id,
    v_listing.daily_rate_aa, v_listing.rate_per_15min_aa,
    v_fee, v_owner_gets,
    p_minutes, v_cost,
    now() + make_interval(mins => p_minutes)
  )
  RETURNING id INTO v_rental_id;

  UPDATE bot_rental_listings SET is_available = false WHERE bot_id = p_bot_id;

  RETURN jsonb_build_object(
    'ok', true,
    'rental_id', v_rental_id,
    'cost_aa', v_cost,
    'fee_aa', v_fee,
    'owner_gets_aa', v_owner_gets,
    'minutes', p_minutes
  );
END;
$$;

-- ── extend_rental: renter pays for more time ─────────────────────────────────

CREATE OR REPLACE FUNCTION extend_rental(
  p_rental_id uuid,
  p_user_id uuid,
  p_minutes int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rental   bot_rentals%ROWTYPE;
  v_bot      profiles%ROWTYPE;
  v_renter   profiles%ROWTYPE;
  v_cost     int;
  v_fee      int;
  v_owner_gets int;
BEGIN
  IF p_minutes IS NULL OR p_minutes < 15 THEN
    RETURN '{"error":"Minimum extension is 15 minutes"}'::jsonb;
  END IF;

  SELECT * INTO v_rental FROM bot_rentals WHERE id = p_rental_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"Rental not found"}'::jsonb; END IF;
  IF v_rental.status <> 'active' THEN
    RETURN '{"error":"Rental is not active"}'::jsonb;
  END IF;
  IF v_rental.renter_id <> p_user_id THEN
    RETURN '{"error":"Only the renter can extend"}'::jsonb;
  END IF;

  SELECT * INTO v_renter FROM profiles WHERE id = v_rental.renter_id;
  SELECT * INTO v_bot    FROM profiles WHERE id = v_rental.bot_id;

  v_cost       := compute_rental_cost(p_minutes, v_rental.rate_per_15min_aa, v_rental.daily_rate_aa);
  v_fee        := CEIL(v_cost * 0.05)::int;
  v_owner_gets := v_cost - v_fee;

  IF v_renter.credit_balance < v_cost THEN
    RETURN jsonb_build_object('error', 'Insufficient credits', 'needed', v_cost);
  END IF;

  UPDATE profiles SET credit_balance = credit_balance - v_cost      WHERE id = v_rental.renter_id;
  UPDATE profiles SET credit_balance = credit_balance + v_owner_gets WHERE id = v_rental.owner_id;

  INSERT INTO transactions (from_id, to_id, amount, fee_amount, type, notes)
  VALUES (v_rental.renter_id, v_rental.owner_id, v_cost, v_fee,
          'rental_payment', format('Bot rental extension: @%s (+%s min)', v_bot.username, p_minutes));

  UPDATE bot_rentals SET
    expires_at      = GREATEST(expires_at, now()) + make_interval(mins => p_minutes),
    total_minutes   = total_minutes + p_minutes,
    total_paid_aa   = total_paid_aa + v_cost,
    platform_fee_aa = platform_fee_aa + v_fee,
    owner_gets_aa   = owner_gets_aa   + v_owner_gets
  WHERE id = p_rental_id;

  RETURN jsonb_build_object(
    'ok', true,
    'minutes_added', p_minutes,
    'cost_aa', v_cost,
    'fee_aa', v_fee,
    'new_expires_at', (SELECT expires_at FROM bot_rentals WHERE id = p_rental_id)
  );
END;
$$;

-- ── expire_due_rentals: marks overdue active rentals as ended ────────────────
-- Called lazily from API reads and also safe to run via cron.

CREATE OR REPLACE FUNCTION expire_due_rentals()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count int;
BEGIN
  WITH expired AS (
    UPDATE bot_rentals
    SET status = 'ended', ended_at = now()
    WHERE status = 'active' AND expires_at <= now()
    RETURNING bot_id
  )
  UPDATE bot_rental_listings
  SET is_available = true
  WHERE bot_id IN (SELECT bot_id FROM expired);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
