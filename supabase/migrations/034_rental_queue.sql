-- Migration 034: Bot rental queue
--
-- When a bot is currently rented and someone else wants it, they can join a
-- FIFO queue instead of being turned away. Two flavours:
--
--   • auto_start = false  → when their turn comes, they get a 5-minute
--                          confirmation window to accept + pay. Miss it and
--                          we skip to the next renter.
--   • auto_start = true   → credits are pre-charged at join time; when the
--                          turn comes, the rental begins automatically and
--                          their pre-loaded instructions are delivered to
--                          the rental chat as the first message. Critical
--                          for timezone-divergent users.
--
-- Owners can cap the queue length via bot_settings.rental_queue_max.

-- ── Owner-configurable queue cap ─────────────────────────────────────────────

ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS rental_queue_max int
    CHECK (rental_queue_max IS NULL OR rental_queue_max > 0);

-- ── Queue table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rental_queue (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id                    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  renter_id                 uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  desired_duration_minutes  int  NOT NULL CHECK (desired_duration_minutes >= 15),
  auto_start                bool NOT NULL DEFAULT false,
  pre_loaded_instructions   text,
  pre_charged_amount        int  NOT NULL DEFAULT 0 CHECK (pre_charged_amount >= 0),
  status                    text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'claimed', 'started', 'left', 'expired')),
  claim_deadline            timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CHECK (bot_id <> renter_id)
);

-- Only one active queue entry per renter per bot.
CREATE UNIQUE INDEX IF NOT EXISTS rental_queue_active_uniq
  ON rental_queue (bot_id, renter_id)
  WHERE status IN ('waiting', 'claimed');

CREATE INDEX IF NOT EXISTS rental_queue_bot_created_idx
  ON rental_queue (bot_id, created_at)
  WHERE status IN ('waiting', 'claimed');

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE rental_queue ENABLE ROW LEVEL SECURITY;

-- Public read of anonymised count is handled through a view; raw rows only
-- visible to the renter, the bot owner, or the bot itself.
CREATE POLICY "Queue entry visible to participants" ON rental_queue
  FOR SELECT USING (
    auth.uid() = renter_id
    OR auth.uid() IN (SELECT owner_id FROM profiles WHERE id = bot_id)
    OR auth.uid() = bot_id
  );

-- ── join_rental_queue ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION join_rental_queue(
  p_bot_id                    uuid,
  p_renter_id                 uuid,
  p_duration_minutes          int,
  p_auto_start                bool,
  p_pre_loaded_instructions   text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_listing        bot_rental_listings%ROWTYPE;
  v_bot            profiles%ROWTYPE;
  v_renter         profiles%ROWTYPE;
  v_settings       bot_settings%ROWTYPE;
  v_owner_id       uuid;
  v_cost           int := 0;
  v_current_queue  int;
  v_queue_id       uuid;
BEGIN
  IF p_duration_minutes IS NULL OR p_duration_minutes < 15 THEN
    RETURN '{"error":"Minimum duration is 15 minutes"}'::jsonb;
  END IF;

  SELECT * INTO v_listing FROM bot_rental_listings WHERE bot_id = p_bot_id;
  IF NOT FOUND THEN RETURN '{"error":"Bot is not listed for rent"}'::jsonb; END IF;

  SELECT * INTO v_bot FROM profiles WHERE id = p_bot_id;
  v_owner_id := v_bot.owner_id;
  IF v_owner_id IS NULL THEN RETURN '{"error":"Bot has no owner"}'::jsonb; END IF;
  IF v_owner_id = p_renter_id THEN RETURN '{"error":"Cannot queue for your own bot"}'::jsonb; END IF;

  -- Enforce queue length cap
  SELECT * INTO v_settings FROM bot_settings WHERE bot_id = p_bot_id;
  IF v_settings.rental_queue_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_queue
    FROM rental_queue
    WHERE bot_id = p_bot_id AND status IN ('waiting', 'claimed');
    IF v_current_queue >= v_settings.rental_queue_max THEN
      RETURN jsonb_build_object('error', 'Queue is full', 'max', v_settings.rental_queue_max);
    END IF;
  END IF;

  -- If auto-start, pre-charge the renter into the escrow.
  IF p_auto_start THEN
    v_cost := compute_rental_cost(p_duration_minutes, v_listing.rate_per_15min_aa, v_listing.daily_rate_aa);
    SELECT * INTO v_renter FROM profiles WHERE id = p_renter_id;
    IF v_renter.credit_balance < v_cost THEN
      RETURN jsonb_build_object('error', 'Insufficient credits for auto-start', 'needed', v_cost);
    END IF;
    UPDATE profiles SET credit_balance = credit_balance - v_cost WHERE id = p_renter_id;
    INSERT INTO transactions (from_id, to_id, amount, type, notes)
    VALUES (p_renter_id, p_renter_id, v_cost, 'rental_queue_hold',
            format('Auto-start queue hold for @%s', v_bot.username));
  END IF;

  INSERT INTO rental_queue (
    bot_id, renter_id, desired_duration_minutes,
    auto_start, pre_loaded_instructions, pre_charged_amount
  )
  VALUES (
    p_bot_id, p_renter_id, p_duration_minutes,
    p_auto_start, p_pre_loaded_instructions, v_cost
  )
  ON CONFLICT ON CONSTRAINT rental_queue_active_uniq DO NOTHING
  RETURNING id INTO v_queue_id;

  IF v_queue_id IS NULL THEN
    -- Hit the unique constraint → refund the escrow we just took.
    IF p_auto_start AND v_cost > 0 THEN
      UPDATE profiles SET credit_balance = credit_balance + v_cost WHERE id = p_renter_id;
    END IF;
    RETURN '{"error":"You are already in the queue for this bot"}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'queue_id', v_queue_id,
    'pre_charged_aa', v_cost
  );
END;
$$;

-- ── leave_rental_queue — refund any escrow ───────────────────────────────────

CREATE OR REPLACE FUNCTION leave_rental_queue(
  p_bot_id uuid,
  p_renter_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entry rental_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM rental_queue
  WHERE bot_id = p_bot_id AND renter_id = p_renter_id
    AND status IN ('waiting', 'claimed')
  FOR UPDATE;

  IF NOT FOUND THEN RETURN '{"error":"Not in queue"}'::jsonb; END IF;

  IF v_entry.pre_charged_amount > 0 THEN
    UPDATE profiles SET credit_balance = credit_balance + v_entry.pre_charged_amount
      WHERE id = v_entry.renter_id;
    INSERT INTO transactions (from_id, to_id, amount, type, notes)
    VALUES (v_entry.renter_id, v_entry.renter_id, v_entry.pre_charged_amount,
            'rental_queue_refund', 'Left rental queue');
  END IF;

  UPDATE rental_queue SET status = 'left', updated_at = now()
    WHERE id = v_entry.id;

  RETURN '{"ok":true}'::jsonb;
END;
$$;

-- ── confirm_queue_claim — non-auto-start renter accepts within deadline ──────
-- Charges credits and starts the rental. Mirrors start_rental but sources
-- terms from the queue entry so the renter can't change them at the last
-- minute to sneak a longer booking past the locked-in slot.

CREATE OR REPLACE FUNCTION confirm_queue_claim(
  p_queue_id uuid,
  p_user_id  uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entry   rental_queue%ROWTYPE;
  v_listing bot_rental_listings%ROWTYPE;
  v_bot     profiles%ROWTYPE;
  v_renter  profiles%ROWTYPE;
  v_owner   uuid;
  v_cost    int;
  v_fee     int;
  v_owner_gets int;
  v_rental_id uuid;
BEGIN
  SELECT * INTO v_entry FROM rental_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"Queue entry not found"}'::jsonb; END IF;
  IF v_entry.renter_id <> p_user_id THEN RETURN '{"error":"Not your queue spot"}'::jsonb; END IF;
  IF v_entry.status <> 'claimed' THEN RETURN '{"error":"Your turn is not active"}'::jsonb; END IF;
  IF v_entry.claim_deadline < now() THEN RETURN '{"error":"Confirmation window expired"}'::jsonb; END IF;

  SELECT * INTO v_listing FROM bot_rental_listings WHERE bot_id = v_entry.bot_id;
  IF NOT FOUND THEN RETURN '{"error":"Bot no longer listed"}'::jsonb; END IF;

  SELECT * INTO v_bot FROM profiles WHERE id = v_entry.bot_id;
  v_owner := v_bot.owner_id;

  v_cost       := compute_rental_cost(v_entry.desired_duration_minutes,
                                       v_listing.rate_per_15min_aa, v_listing.daily_rate_aa);
  v_fee        := CEIL(v_cost * 0.05)::int;
  v_owner_gets := v_cost - v_fee;

  SELECT * INTO v_renter FROM profiles WHERE id = v_entry.renter_id;
  IF v_renter.credit_balance < v_cost THEN
    RETURN jsonb_build_object('error', 'Insufficient credits', 'needed', v_cost);
  END IF;

  UPDATE profiles SET credit_balance = credit_balance - v_cost      WHERE id = v_entry.renter_id;
  UPDATE profiles SET credit_balance = credit_balance + v_owner_gets WHERE id = v_owner;

  INSERT INTO transactions (from_id, to_id, amount, fee_amount, type, notes)
  VALUES (v_entry.renter_id, v_owner, v_cost, v_fee,
          'rental_payment', format('Queue confirm: @%s (%s min)', v_bot.username, v_entry.desired_duration_minutes));

  INSERT INTO bot_rentals (
    bot_id, owner_id, renter_id,
    daily_rate_aa, rate_per_15min_aa,
    platform_fee_aa, owner_gets_aa,
    total_minutes, total_paid_aa,
    expires_at
  )
  VALUES (
    v_entry.bot_id, v_owner, v_entry.renter_id,
    v_listing.daily_rate_aa, v_listing.rate_per_15min_aa,
    v_fee, v_owner_gets,
    v_entry.desired_duration_minutes, v_cost,
    now() + make_interval(mins => v_entry.desired_duration_minutes)
  )
  RETURNING id INTO v_rental_id;

  UPDATE bot_rental_listings SET is_available = false WHERE bot_id = v_entry.bot_id;
  UPDATE rental_queue SET status = 'started', updated_at = now() WHERE id = v_entry.id;

  -- Deliver any pre-loaded instructions to the rental chat.
  IF v_entry.pre_loaded_instructions IS NOT NULL AND length(trim(v_entry.pre_loaded_instructions)) > 0 THEN
    INSERT INTO rental_messages (rental_id, sender_id, content)
    VALUES (v_rental_id, v_entry.renter_id, v_entry.pre_loaded_instructions);
  END IF;

  RETURN jsonb_build_object('ok', true, 'rental_id', v_rental_id);
END;
$$;

-- ── auto_start_queue_entry — promote auto_start entry immediately ────────────
-- Called from promote_next_renter when the front of the queue has
-- auto_start=true and pre_charged_amount > 0. Credits were already debited
-- at join time; we just create the rental row, pay the owner, and deliver
-- the pre-loaded message.

CREATE OR REPLACE FUNCTION auto_start_queue_entry(p_queue_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entry   rental_queue%ROWTYPE;
  v_listing bot_rental_listings%ROWTYPE;
  v_bot     profiles%ROWTYPE;
  v_owner   uuid;
  v_cost    int;
  v_fee     int;
  v_owner_gets int;
  v_rental_id uuid;
BEGIN
  SELECT * INTO v_entry FROM rental_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND OR NOT v_entry.auto_start THEN
    RETURN '{"error":"Not an auto-start queue entry"}'::jsonb;
  END IF;

  SELECT * INTO v_listing FROM bot_rental_listings WHERE bot_id = v_entry.bot_id;
  SELECT * INTO v_bot     FROM profiles WHERE id = v_entry.bot_id;
  v_owner := v_bot.owner_id;

  -- Recompute in case rates changed between join and turn. If it's cheaper
  -- than what we pre-charged, refund the difference. If it's more expensive,
  -- silently absorb it — we locked the price at join, not at start.
  v_cost := LEAST(v_entry.pre_charged_amount,
                  compute_rental_cost(v_entry.desired_duration_minutes,
                                      v_listing.rate_per_15min_aa, v_listing.daily_rate_aa));
  v_fee        := CEIL(v_cost * 0.05)::int;
  v_owner_gets := v_cost - v_fee;

  -- Refund any leftover escrow.
  IF v_entry.pre_charged_amount > v_cost THEN
    UPDATE profiles SET credit_balance = credit_balance + (v_entry.pre_charged_amount - v_cost)
      WHERE id = v_entry.renter_id;
    INSERT INTO transactions (from_id, to_id, amount, type, notes)
    VALUES (v_entry.renter_id, v_entry.renter_id,
            v_entry.pre_charged_amount - v_cost,
            'rental_queue_refund', 'Queue rate adjustment refund');
  END IF;

  UPDATE profiles SET credit_balance = credit_balance + v_owner_gets WHERE id = v_owner;

  INSERT INTO transactions (from_id, to_id, amount, fee_amount, type, notes)
  VALUES (v_entry.renter_id, v_owner, v_cost, v_fee,
          'rental_payment', format('Auto-start queue rental: @%s', v_bot.username));

  INSERT INTO bot_rentals (
    bot_id, owner_id, renter_id,
    daily_rate_aa, rate_per_15min_aa,
    platform_fee_aa, owner_gets_aa,
    total_minutes, total_paid_aa,
    expires_at
  )
  VALUES (
    v_entry.bot_id, v_owner, v_entry.renter_id,
    v_listing.daily_rate_aa, v_listing.rate_per_15min_aa,
    v_fee, v_owner_gets,
    v_entry.desired_duration_minutes, v_cost,
    now() + make_interval(mins => v_entry.desired_duration_minutes)
  )
  RETURNING id INTO v_rental_id;

  UPDATE bot_rental_listings SET is_available = false WHERE bot_id = v_entry.bot_id;
  UPDATE rental_queue SET status = 'started', updated_at = now() WHERE id = v_entry.id;

  -- Deliver the pre-loaded instructions to the rental chat so the bot can
  -- start working before the renter is even online.
  IF v_entry.pre_loaded_instructions IS NOT NULL AND length(trim(v_entry.pre_loaded_instructions)) > 0 THEN
    INSERT INTO rental_messages (rental_id, sender_id, content)
    VALUES (v_rental_id, v_entry.renter_id, v_entry.pre_loaded_instructions);
  END IF;

  RETURN jsonb_build_object('ok', true, 'rental_id', v_rental_id);
END;
$$;

-- ── promote_next_renter ──────────────────────────────────────────────────────
-- Called whenever a bot becomes free. Promotes the head of the queue:
--   • auto_start=true  → spin up the rental right now via auto_start_queue_entry
--   • auto_start=false → mark 'claimed' with a 5-minute deadline for the
--                        renter to confirm
-- Returns information about what happened so the caller can notify the
-- relevant renter.

CREATE OR REPLACE FUNCTION promote_next_renter(p_bot_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entry rental_queue%ROWTYPE;
  v_res   jsonb;
BEGIN
  -- Skip if bot still has an active rental.
  IF EXISTS (SELECT 1 FROM bot_rentals WHERE bot_id = p_bot_id AND status = 'active') THEN
    RETURN '{"ok":false, "reason":"bot_still_rented"}'::jsonb;
  END IF;

  SELECT * INTO v_entry
  FROM rental_queue
  WHERE bot_id = p_bot_id AND status = 'waiting'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RETURN '{"ok":false, "reason":"queue_empty"}'::jsonb; END IF;

  IF v_entry.auto_start THEN
    v_res := auto_start_queue_entry(v_entry.id);
    RETURN jsonb_build_object(
      'ok', COALESCE((v_res->>'ok')::bool, false),
      'action', 'auto_started',
      'queue_id', v_entry.id,
      'renter_id', v_entry.renter_id,
      'rental_id', v_res->'rental_id'
    );
  ELSE
    UPDATE rental_queue
    SET status = 'claimed',
        claim_deadline = now() + interval '5 minutes',
        updated_at = now()
    WHERE id = v_entry.id;
    RETURN jsonb_build_object(
      'ok', true,
      'action', 'claimed',
      'queue_id', v_entry.id,
      'renter_id', v_entry.renter_id,
      'claim_deadline', (now() + interval '5 minutes')
    );
  END IF;
END;
$$;

-- ── expire_stale_claims ──────────────────────────────────────────────────────
-- Called from API reads. Any 'claimed' entry past its deadline is marked
-- expired, and the next candidate is promoted. Returns the number of
-- entries that were expired.

CREATE OR REPLACE FUNCTION expire_stale_claims()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row rental_queue%ROWTYPE;
  v_n   int := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM rental_queue
    WHERE status = 'claimed' AND claim_deadline < now()
    FOR UPDATE
  LOOP
    UPDATE rental_queue SET status = 'expired', updated_at = now() WHERE id = v_row.id;
    v_n := v_n + 1;
    -- Promote the next renter for this bot if there's no active rental.
    PERFORM promote_next_renter(v_row.bot_id);
  END LOOP;
  RETURN v_n;
END;
$$;

-- ── end_rental wrapper → promote next renter automatically ───────────────────

CREATE OR REPLACE FUNCTION end_rental(p_rental_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rental bot_rentals%ROWTYPE;
  v_promo  jsonb;
BEGIN
  SELECT * INTO v_rental FROM bot_rentals WHERE id = p_rental_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"Rental not found"}'::jsonb; END IF;
  IF v_rental.status <> 'active' THEN RETURN '{"error":"Rental is not active"}'::jsonb; END IF;
  IF p_user_id <> v_rental.owner_id AND p_user_id <> v_rental.renter_id THEN
    RETURN '{"error":"Not authorized"}'::jsonb;
  END IF;

  UPDATE bot_rentals SET status = 'ended', ended_at = now(), ended_by = p_user_id
    WHERE id = p_rental_id;
  UPDATE bot_rental_listings SET is_available = true WHERE bot_id = v_rental.bot_id;

  v_promo := promote_next_renter(v_rental.bot_id);
  RETURN jsonb_build_object('ok', true, 'promotion', v_promo);
END;
$$;

-- Same for expire_due_rentals: when the clock auto-ends a rental, promote
-- the next renter.
CREATE OR REPLACE FUNCTION expire_due_rentals()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bot_id uuid;
  v_count  int := 0;
BEGIN
  FOR v_bot_id IN
    SELECT bot_id FROM bot_rentals WHERE status = 'active' AND expires_at <= now() FOR UPDATE
  LOOP
    UPDATE bot_rentals SET status = 'ended', ended_at = now()
      WHERE bot_id = v_bot_id AND status = 'active';
    UPDATE bot_rental_listings SET is_available = true WHERE bot_id = v_bot_id;
    PERFORM promote_next_renter(v_bot_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
