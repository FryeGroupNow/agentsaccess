-- Migration 019: AA Credit spending preference
-- Run in Supabase SQL editor after migration 018.
--
-- Adds a per-user preference for whether to spend non-cashable Starter AA
-- first or preserve it and spend Redeemable AA first. Updates the two
-- deduction functions (transfer_credits, place_ad_bid) to respect it.

-- ─── profiles.spend_preference ──────────────────────────────────────────────

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

-- ─── transfer_credits with preference-aware bonus decrement ────────────────

CREATE OR REPLACE FUNCTION transfer_credits(
  p_from_id    UUID,
  p_to_id      UUID,
  p_amount     INTEGER,
  p_type       transaction_type,
  p_product_id UUID    DEFAULT NULL,
  p_notes      TEXT    DEFAULT NULL,
  p_buyer_fee  INTEGER DEFAULT 0,
  p_seller_fee INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_balance        INTEGER;
  v_bonus          INTEGER;
  v_pref           TEXT;
  v_total_debit    INTEGER;
  v_total_credit   INTEGER;
  v_starter_spent  INTEGER;
  v_redeemable     INTEGER;
BEGIN
  v_total_debit  := p_amount + p_buyer_fee;
  v_total_credit := p_amount - p_seller_fee;

  SELECT credit_balance, bonus_balance, spend_preference
    INTO v_balance, v_bonus, v_pref
    FROM profiles
   WHERE id = p_from_id
     FOR UPDATE;

  v_redeemable := v_balance - v_bonus;

  IF p_type = 'cashout' THEN
    -- Only redeemable credits can be withdrawn (buyer_fee = 0 for cashouts)
    IF v_redeemable < v_total_debit THEN
      RAISE EXCEPTION 'Insufficient redeemable credits: % AA available (% total, % Starter AA)',
        GREATEST(0, v_redeemable), v_balance, v_bonus;
    END IF;
  ELSE
    IF v_balance < v_total_debit THEN
      RAISE EXCEPTION 'Insufficient credits: have % AA, need % AA', v_balance, v_total_debit;
    END IF;
  END IF;

  -- Branch on user's spend preference to decide how much starter to consume.
  -- Cashouts always come from redeemable only, so starter_spent = 0.
  IF p_type = 'cashout' THEN
    v_starter_spent := 0;
  ELSIF v_pref = 'redeemable_first' THEN
    -- Only touch starter when redeemable can't cover the debit
    v_starter_spent := GREATEST(0, v_total_debit - v_redeemable);
  ELSE
    -- starter_first (default): drain bonus first
    v_starter_spent := LEAST(v_bonus, v_total_debit);
  END IF;

  UPDATE profiles
     SET credit_balance = credit_balance - v_total_debit,
         bonus_balance  = bonus_balance  - v_starter_spent
   WHERE id = p_from_id;

  IF p_to_id IS NOT NULL THEN
    UPDATE profiles
       SET credit_balance = credit_balance + v_total_credit
     WHERE id = p_to_id;
  END IF;

  INSERT INTO transactions (from_id, to_id, amount, type, product_id, notes, fee_amount)
  VALUES (p_from_id, p_to_id, p_amount, p_type, p_product_id, p_notes,
          p_buyer_fee + p_seller_fee)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── place_ad_bid with preference-aware bonus decrement ────────────────────
-- Previously only decremented credit_balance without touching bonus_balance,
-- which meant starter credits were never actually debited on ad bids. Fix
-- that and respect the preference at the same time.

CREATE OR REPLACE FUNCTION place_ad_bid(
  p_bidder_id    uuid,
  p_slot_id      smallint,
  p_product_id   uuid,
  p_amount       integer,
  p_period_start timestamptz
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id     uuid;
  v_existing_amount integer;
  v_balance         integer;
  v_bonus           integer;
  v_pref            text;
  v_redeemable      integer;
  v_deduction       integer;
  v_starter_spent   integer;
  v_bid_id          uuid;
BEGIN
  SELECT credit_balance, bonus_balance, spend_preference
    INTO v_balance, v_bonus, v_pref
    FROM profiles
   WHERE id = p_bidder_id
     FOR UPDATE;

  v_redeemable := v_balance - v_bonus;

  SELECT id, amount_credits
    INTO v_existing_id, v_existing_amount
    FROM ad_bids
   WHERE slot_id      = p_slot_id
     AND bidder_id    = p_bidder_id
     AND period_start = p_period_start
     AND status       = 'pending';

  IF v_existing_id IS NOT NULL THEN
    v_deduction := p_amount - v_existing_amount;

    IF v_deduction > 0 AND v_balance < v_deduction THEN
      RETURN json_build_object('error', 'Insufficient credit balance');
    END IF;

    -- For incremental debits, only decrement starter according to preference
    IF v_deduction > 0 THEN
      IF v_pref = 'redeemable_first' THEN
        v_starter_spent := GREATEST(0, v_deduction - v_redeemable);
      ELSE
        v_starter_spent := LEAST(v_bonus, v_deduction);
      END IF;
    ELSE
      -- Refund path (bid lowered): credit back redeemable first, but do not
      -- increment bonus_balance (starter refunds are complicated; simpler
      -- to treat lowered bids as redeemable). Negative deduction = credit.
      v_starter_spent := 0;
    END IF;

    UPDATE profiles
      SET credit_balance = credit_balance - v_deduction,
          bonus_balance  = bonus_balance  - v_starter_spent
      WHERE id = p_bidder_id;

    UPDATE ad_bids
      SET amount_credits = p_amount,
          product_id     = p_product_id
      WHERE id = v_existing_id
      RETURNING id INTO v_bid_id;
  ELSE
    IF v_balance < p_amount THEN
      RETURN json_build_object('error', 'Insufficient credit balance');
    END IF;

    IF v_pref = 'redeemable_first' THEN
      v_starter_spent := GREATEST(0, p_amount - v_redeemable);
    ELSE
      v_starter_spent := LEAST(v_bonus, p_amount);
    END IF;

    UPDATE profiles
      SET credit_balance = credit_balance - p_amount,
          bonus_balance  = bonus_balance  - v_starter_spent
      WHERE id = p_bidder_id;

    INSERT INTO ad_bids (slot_id, bidder_id, product_id, amount_credits, period_start)
    VALUES (p_slot_id, p_bidder_id, p_product_id, p_amount, p_period_start)
    RETURNING id INTO v_bid_id;
  END IF;

  RETURN json_build_object('ok', true, 'bid_id', v_bid_id);
END;
$$;
