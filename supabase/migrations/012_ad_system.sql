-- Ad slots: 6 fixed positions (3 left, 3 right in the feed sidebar)
CREATE TABLE ad_slots (
  id       smallint PRIMARY KEY,
  side     text     NOT NULL CHECK (side IN ('left', 'right')),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3)
);

INSERT INTO ad_slots (id, side, position) VALUES
  (1, 'left',  1),
  (2, 'left',  2),
  (3, 'left',  3),
  (4, 'right', 1),
  (5, 'right', 2),
  (6, 'right', 3);

-- Ad bids: one active bid per user per slot per hourly period
CREATE TABLE ad_bids (
  id             uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id        smallint NOT NULL REFERENCES ad_slots(id),
  bidder_id      uuid     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id     uuid     NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  amount_credits integer  NOT NULL CHECK (amount_credits >= 1),
  period_start   timestamptz NOT NULL,   -- UTC truncated to the hour
  status         text     NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'won', 'refunded', 'cancelled')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, bidder_id, period_start)
);

CREATE INDEX ON ad_bids (slot_id, period_start, status);
CREATE INDEX ON ad_bids (bidder_id);

-- Ad placements: settled winning placements with impression / click tracking
CREATE TABLE ad_placements (
  id                  uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id             smallint NOT NULL REFERENCES ad_slots(id),
  bid_id              uuid     REFERENCES ad_bids(id),
  product_id          uuid     NOT NULL REFERENCES products(id),
  winner_id           uuid     NOT NULL REFERENCES profiles(id),
  winning_bid_credits integer  NOT NULL,
  period_start        timestamptz NOT NULL,
  period_end          timestamptz NOT NULL,
  impressions         integer  NOT NULL DEFAULT 0,
  clicks              integer  NOT NULL DEFAULT 0,
  settled_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, period_start)
);

CREATE INDEX ON ad_placements (slot_id, period_start);
CREATE INDEX ON ad_placements (winner_id);
CREATE INDEX ON ad_placements (product_id);

-- RLS -----------------------------------------------------------------------
ALTER TABLE ad_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_bids       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_slots_select"        ON ad_slots      FOR SELECT USING (true);
CREATE POLICY "ad_bids_select"         ON ad_bids       FOR SELECT USING (true);
CREATE POLICY "ad_bids_insert"         ON ad_bids       FOR INSERT WITH CHECK (auth.uid() = bidder_id);
CREATE POLICY "ad_bids_update_owner"   ON ad_bids       FOR UPDATE USING (auth.uid() = bidder_id);
CREATE POLICY "ad_placements_select"   ON ad_placements FOR SELECT USING (true);

-- Atomically settle one slot auction -----------------------------------------
-- Picks the highest pending bid, refunds losers, creates placement.
-- Returns the placement id (or NULL if no bids).
CREATE OR REPLACE FUNCTION settle_ad_auction(p_slot_id smallint, p_period_start timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bid_id       uuid;
  v_bidder_id    uuid;
  v_product_id   uuid;
  v_amount       integer;
  v_placement_id uuid;
BEGIN
  -- Already settled?
  SELECT id INTO v_placement_id
  FROM ad_placements
  WHERE slot_id = p_slot_id AND period_start = p_period_start;

  IF v_placement_id IS NOT NULL THEN
    RETURN v_placement_id;
  END IF;

  -- Find highest pending bid (earliest created_at as tiebreaker)
  SELECT id, bidder_id, product_id, amount_credits
  INTO   v_bid_id, v_bidder_id, v_product_id, v_amount
  FROM   ad_bids
  WHERE  slot_id      = p_slot_id
    AND  period_start = p_period_start
    AND  status       = 'pending'
  ORDER BY amount_credits DESC, created_at ASC
  LIMIT 1;

  IF v_bid_id IS NULL THEN
    RETURN NULL;   -- No bids to settle
  END IF;

  -- Mark winner
  UPDATE ad_bids SET status = 'won' WHERE id = v_bid_id;

  -- Refund losing bidders directly
  UPDATE profiles p
  SET    credit_balance = credit_balance + ab.amount_credits
  FROM   ad_bids ab
  WHERE  ab.slot_id      = p_slot_id
    AND  ab.period_start = p_period_start
    AND  ab.status       = 'pending'
    AND  ab.id          != v_bid_id
    AND  p.id            = ab.bidder_id;

  -- Mark losers refunded
  UPDATE ad_bids
  SET    status = 'refunded'
  WHERE  slot_id      = p_slot_id
    AND  period_start = p_period_start
    AND  status       = 'pending'
    AND  id          != v_bid_id;

  -- Create placement (winner's bid amount is kept as platform revenue)
  INSERT INTO ad_placements (
    slot_id, bid_id, product_id, winner_id, winning_bid_credits,
    period_start, period_end
  )
  VALUES (
    p_slot_id, v_bid_id, v_product_id, v_bidder_id, v_amount,
    p_period_start, p_period_start + interval '1 hour'
  )
  RETURNING id INTO v_placement_id;

  RETURN v_placement_id;
END;
$$;

-- Increment impression or click counter atomically ---------------------------
CREATE OR REPLACE FUNCTION increment_ad_stat(p_placement_id uuid, p_column text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_column = 'impressions' THEN
    UPDATE ad_placements SET impressions = impressions + 1 WHERE id = p_placement_id;
  ELSIF p_column = 'clicks' THEN
    UPDATE ad_placements SET clicks = clicks + 1 WHERE id = p_placement_id;
  END IF;
END;
$$;

-- Atomically place or update a bid -------------------------------------------
-- Deducts credits and inserts/updates the bid row.  Returns JSON {ok,bid_id}
-- or {error}.
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
  v_deduction       integer;
  v_bid_id          uuid;
BEGIN
  -- Lock the bidder row
  SELECT credit_balance INTO v_balance
  FROM   profiles
  WHERE  id = p_bidder_id
  FOR UPDATE;

  -- Existing pending bid for this slot + period?
  SELECT id, amount_credits
  INTO   v_existing_id, v_existing_amount
  FROM   ad_bids
  WHERE  slot_id      = p_slot_id
    AND  bidder_id    = p_bidder_id
    AND  period_start = p_period_start
    AND  status       = 'pending';

  IF v_existing_id IS NOT NULL THEN
    -- Updating an existing bid
    v_deduction := p_amount - v_existing_amount;

    IF v_deduction > 0 AND v_balance < v_deduction THEN
      RETURN json_build_object('error', 'Insufficient credit balance');
    END IF;

    UPDATE profiles
    SET    credit_balance = credit_balance - v_deduction
    WHERE  id = p_bidder_id;

    UPDATE ad_bids
    SET    amount_credits = p_amount,
           product_id     = p_product_id
    WHERE  id = v_existing_id
    RETURNING id INTO v_bid_id;
  ELSE
    -- New bid
    IF v_balance < p_amount THEN
      RETURN json_build_object('error', 'Insufficient credit balance');
    END IF;

    UPDATE profiles
    SET    credit_balance = credit_balance - p_amount
    WHERE  id = p_bidder_id;

    INSERT INTO ad_bids (slot_id, bidder_id, product_id, amount_credits, period_start)
    VALUES (p_slot_id, p_bidder_id, p_product_id, p_amount, p_period_start)
    RETURNING id INTO v_bid_id;
  END IF;

  RETURN json_build_object('ok', true, 'bid_id', v_bid_id);
END;
$$;
