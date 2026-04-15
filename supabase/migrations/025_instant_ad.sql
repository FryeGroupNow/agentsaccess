-- Migration 025: Instant ad placements
-- Run in Supabase SQL editor.
--
-- The existing place_ad_bid + settle_ad_auction flow works, but bids are
-- always recorded for the NEXT hour. They only become live ads when:
--   1. the next hour rolls over, AND
--   2. someone calls /api/ads/slots after the rollover
--
-- That's a terrible UX — users bid and don't see anything for up to 60
-- minutes. This RPC short-circuits the auction for empty slots: if no
-- placement exists for the current hour, the user can spend 1 AA and the
-- placement is created immediately, with no waiting and no auction.
--
-- If the slot is already occupied for the current hour, the call returns
-- an error and the user must use the normal place_ad_bid path to bid for
-- the next hour.

CREATE OR REPLACE FUNCTION place_instant_ad(
  p_bidder_id  uuid,
  p_slot_id    smallint,
  p_product_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start timestamptz := date_trunc('hour', now());
  v_period_end   timestamptz := v_period_start + interval '1 hour';
  v_existing     uuid;
  v_balance      integer;
  v_bonus        integer;
  v_pref         text;
  v_redeemable   integer;
  v_starter      integer;
  v_bid_id       uuid;
  v_placement_id uuid;
BEGIN
  -- Slot already taken for this hour?
  SELECT id INTO v_existing
    FROM ad_placements
   WHERE slot_id = p_slot_id
     AND period_start = v_period_start;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object(
      'error', 'Slot is already running an ad this hour. Bid for the next hour instead.'
    );
  END IF;

  -- Lock the bidder's profile and check balance
  SELECT credit_balance, bonus_balance, COALESCE(spend_preference, 'starter_first')
    INTO v_balance, v_bonus, v_pref
    FROM profiles
   WHERE id = p_bidder_id
     FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN json_build_object('error', 'Bidder profile not found');
  END IF;
  IF v_balance < 1 THEN
    RETURN json_build_object('error', 'Insufficient credits — need at least 1 AA');
  END IF;

  v_redeemable := v_balance - v_bonus;

  -- Apply spend preference for the 1 AA charge (mirrors transfer_credits)
  IF v_pref = 'redeemable_first' THEN
    v_starter := GREATEST(0, 1 - v_redeemable);
  ELSE
    v_starter := LEAST(v_bonus, 1);
  END IF;

  UPDATE profiles
     SET credit_balance = credit_balance - 1,
         bonus_balance  = bonus_balance  - v_starter
   WHERE id = p_bidder_id;

  -- Best-effort: clear any existing pending bid for the same slot/period/bidder
  -- so the UNIQUE constraint on ad_bids doesn't trip
  DELETE FROM ad_bids
   WHERE slot_id      = p_slot_id
     AND bidder_id    = p_bidder_id
     AND period_start = v_period_start
     AND status       = 'pending';

  -- Insert a winning bid record (bookkeeping)
  INSERT INTO ad_bids (slot_id, bidder_id, product_id, amount_credits, period_start, status)
  VALUES (p_slot_id, p_bidder_id, p_product_id, 1, v_period_start, 'won')
  RETURNING id INTO v_bid_id;

  -- Create the placement directly — no auction, no settlement step
  INSERT INTO ad_placements (
    slot_id, bid_id, product_id, winner_id, winning_bid_credits,
    period_start, period_end
  )
  VALUES (
    p_slot_id, v_bid_id, p_product_id, p_bidder_id, 1,
    v_period_start, v_period_end
  )
  RETURNING id INTO v_placement_id;

  RETURN json_build_object(
    'ok', true,
    'placement_id', v_placement_id,
    'bid_id', v_bid_id,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
END;
$$;
