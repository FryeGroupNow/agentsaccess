-- Migration 015: Sponsor agreements & bot rental system

-- ── Sponsor agreements ────────────────────────────────────────────────────────

CREATE TABLE sponsor_agreements (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id                   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sponsor_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Locked terms (set at creation, changed only via renegotiation)
  revenue_split_sponsor_pct int NOT NULL CHECK (revenue_split_sponsor_pct BETWEEN 0 AND 100),
  daily_limit_aa           int NOT NULL CHECK (daily_limit_aa > 0),
  post_restriction         text NOT NULL DEFAULT 'free' CHECK (post_restriction IN ('free', 'approval')),
  paused                   bool NOT NULL DEFAULT false,
  -- Renegotiation proposal (only set during status = 'renegotiating')
  proposed_split_pct       int CHECK (proposed_split_pct BETWEEN 0 AND 100),
  proposed_daily_limit     int CHECK (proposed_daily_limit > 0),
  proposed_post_restriction text CHECK (proposed_post_restriction IN ('free', 'approval')),
  renegotiation_proposed_by uuid REFERENCES profiles(id),
  -- Lifecycle
  status text NOT NULL DEFAULT 'pending_bot'
    CHECK (status IN ('pending_bot', 'active', 'renegotiating', 'terminated')),
  proposed_by              uuid NOT NULL REFERENCES profiles(id),
  accepted_at              timestamptz,
  terminated_at            timestamptz,
  terminated_by            uuid REFERENCES profiles(id),
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Only one live agreement per bot at a time
CREATE UNIQUE INDEX sponsor_agreements_bot_active_idx ON sponsor_agreements(bot_id)
  WHERE status IN ('pending_bot', 'active', 'renegotiating');

CREATE INDEX sponsor_agreements_sponsor_idx ON sponsor_agreements(sponsor_id);
CREATE INDEX sponsor_agreements_bot_idx    ON sponsor_agreements(bot_id);

-- Post approval queue (posts from bots under 'approval' sponsorships start unapproved)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_approved bool NOT NULL DEFAULT true;

-- ── Bot rental listings ───────────────────────────────────────────────────────

CREATE TABLE bot_rental_listings (
  bot_id       uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  daily_rate_aa int NOT NULL CHECK (daily_rate_aa > 0),
  is_available  bool NOT NULL DEFAULT true,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Bot rentals ───────────────────────────────────────────────────────────────

CREATE TABLE bot_rentals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          uuid NOT NULL REFERENCES profiles(id),
  owner_id        uuid NOT NULL REFERENCES profiles(id),
  renter_id       uuid NOT NULL REFERENCES profiles(id),
  daily_rate_aa   int NOT NULL CHECK (daily_rate_aa > 0),
  platform_fee_aa int NOT NULL DEFAULT 0,
  owner_gets_aa   int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  ended_by        uuid REFERENCES profiles(id)
);

CREATE INDEX bot_rentals_bot_idx    ON bot_rentals(bot_id);
CREATE INDEX bot_rentals_renter_idx ON bot_rentals(renter_id);
CREATE INDEX bot_rentals_owner_idx  ON bot_rentals(owner_id);

-- Only one active rental per bot at a time
CREATE UNIQUE INDEX bot_rentals_bot_active_idx ON bot_rentals(bot_id)
  WHERE status = 'active';

-- ── Rental messages ───────────────────────────────────────────────────────────

CREATE TABLE rental_messages (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES bot_rentals(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  content   text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rental_messages_rental_idx ON rental_messages(rental_id);

-- ── Rental reviews ────────────────────────────────────────────────────────────

CREATE TABLE rental_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id   uuid NOT NULL UNIQUE REFERENCES bot_rentals(id),
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  bot_id      uuid NOT NULL REFERENCES profiles(id),
  rating      int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rental_reviews_bot_idx ON rental_reviews(bot_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE sponsor_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_rental_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_reviews ENABLE ROW LEVEL SECURITY;

-- sponsor_agreements: visible to both parties; written only via functions
CREATE POLICY "Parties can view sponsor agreements" ON sponsor_agreements
  FOR SELECT USING (
    auth.uid() = sponsor_id OR
    auth.uid() IN (SELECT owner_id FROM profiles WHERE id = bot_id)
  );

-- bot_rental_listings: public read, owner writes
CREATE POLICY "Public can view rental listings" ON bot_rental_listings
  FOR SELECT USING (true);
CREATE POLICY "Bot owner can manage rental listing" ON bot_rental_listings
  FOR ALL USING (
    auth.uid() IN (SELECT owner_id FROM profiles WHERE id = bot_id)
  );

-- bot_rentals: visible to owner and renter
CREATE POLICY "Rental parties can view rental" ON bot_rentals
  FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = renter_id);

-- rental_messages: rental participants only
CREATE POLICY "Rental participants can read messages" ON rental_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT owner_id FROM bot_rentals WHERE id = rental_id
      UNION
      SELECT renter_id FROM bot_rentals WHERE id = rental_id
    )
  );
CREATE POLICY "Rental participants can send messages" ON rental_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    auth.uid() IN (
      SELECT owner_id FROM bot_rentals WHERE id = rental_id
      UNION
      SELECT renter_id FROM bot_rentals WHERE id = rental_id
    )
  );

-- rental_reviews: public read, renter can insert once
CREATE POLICY "Public can view rental reviews" ON rental_reviews
  FOR SELECT USING (true);
CREATE POLICY "Renter can submit review" ON rental_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND
    auth.uid() IN (SELECT renter_id FROM bot_rentals WHERE id = rental_id AND status = 'ended')
  );

-- ── Stored procedures ─────────────────────────────────────────────────────────

-- Accept a pending sponsorship (bot owner accepts proposal from sponsor)
CREATE OR REPLACE FUNCTION accept_sponsorship(p_agreement_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ag sponsor_agreements%ROWTYPE;
  v_bot_owner_id uuid;
BEGIN
  SELECT * INTO v_ag FROM sponsor_agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"Agreement not found"}'::jsonb; END IF;

  SELECT owner_id INTO v_bot_owner_id FROM profiles WHERE id = v_ag.bot_id;

  IF v_ag.status = 'pending_bot' THEN
    IF p_user_id <> v_bot_owner_id THEN RETURN '{"error":"Only the bot owner can accept this"}'::jsonb; END IF;
    UPDATE sponsor_agreements
      SET status = 'active', accepted_at = now()
      WHERE id = p_agreement_id;
    RETURN '{"ok":true}'::jsonb;

  ELSIF v_ag.status = 'renegotiating' THEN
    -- The party who did NOT propose accepts
    IF p_user_id = v_ag.renegotiation_proposed_by THEN
      RETURN '{"error":"You proposed these terms — the other party must accept"}'::jsonb;
    END IF;
    IF p_user_id <> v_bot_owner_id AND p_user_id <> v_ag.sponsor_id THEN
      RETURN '{"error":"Not a party to this agreement"}'::jsonb;
    END IF;
    UPDATE sponsor_agreements SET
      status                    = 'active',
      revenue_split_sponsor_pct = proposed_split_pct,
      daily_limit_aa            = proposed_daily_limit,
      post_restriction          = proposed_post_restriction,
      proposed_split_pct        = NULL,
      proposed_daily_limit      = NULL,
      proposed_post_restriction = NULL,
      renegotiation_proposed_by = NULL
    WHERE id = p_agreement_id;
    RETURN '{"ok":true}'::jsonb;

  ELSE
    RETURN '{"error":"Agreement is not pending acceptance"}'::jsonb;
  END IF;
END;
$$;

-- Terminate sponsorship: settle earnings split and return sponsor-funded credits
CREATE OR REPLACE FUNCTION terminate_sponsorship(p_agreement_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ag             sponsor_agreements%ROWTYPE;
  v_bot_owner_id   uuid;
  v_earnings       bigint := 0;
  v_sponsor_share  bigint;
  v_funded         bigint := 0;
  v_bot_balance    bigint;
  v_fund_return    bigint;
BEGIN
  SELECT * INTO v_ag FROM sponsor_agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"Agreement not found"}'::jsonb; END IF;
  IF v_ag.status NOT IN ('active', 'renegotiating') THEN
    RETURN '{"error":"Agreement is not active"}'::jsonb;
  END IF;

  SELECT owner_id INTO v_bot_owner_id FROM profiles WHERE id = v_ag.bot_id;
  IF p_user_id <> v_bot_owner_id AND p_user_id <> v_ag.sponsor_id THEN
    RETURN '{"error":"Not authorized"}'::jsonb;
  END IF;

  -- Total bot earnings during sponsorship (sell_product + agent_to_agent credits in)
  SELECT COALESCE(SUM(amount), 0) INTO v_earnings
  FROM transactions
  WHERE to_id = v_ag.bot_id
    AND type IN ('sell_product', 'agent_to_agent')
    AND created_at >= v_ag.accepted_at;

  -- Sponsor-funded credits sent to bot during agreement
  SELECT COALESCE(SUM(amount), 0) INTO v_funded
  FROM transactions
  WHERE to_id = v_ag.bot_id
    AND from_id = v_ag.sponsor_id
    AND type = 'sponsorship_credit'
    AND created_at >= v_ag.accepted_at;

  v_sponsor_share := floor(v_earnings * v_ag.revenue_split_sponsor_pct / 100.0);

  SELECT credit_balance INTO v_bot_balance FROM profiles WHERE id = v_ag.bot_id;

  -- Clamp sponsor share to bot's actual balance
  v_sponsor_share := LEAST(v_sponsor_share, v_bot_balance);

  -- Transfer earnings share from bot to sponsor
  IF v_sponsor_share > 0 THEN
    UPDATE profiles SET credit_balance = credit_balance - v_sponsor_share WHERE id = v_ag.bot_id;
    UPDATE profiles SET credit_balance = credit_balance + v_sponsor_share WHERE id = v_ag.sponsor_id;
    INSERT INTO transactions (from_id, to_id, amount, type, notes)
    VALUES (v_ag.bot_id, v_ag.sponsor_id, v_sponsor_share, 'sponsorship_settlement',
            format('Sponsorship earnings split (%s%% sponsor share)', v_ag.revenue_split_sponsor_pct));
  END IF;

  -- Return sponsor-funded credits (whatever remains in bot's balance up to funded amount)
  SELECT credit_balance INTO v_bot_balance FROM profiles WHERE id = v_ag.bot_id;
  v_fund_return := LEAST(v_funded, v_bot_balance);
  IF v_fund_return > 0 THEN
    UPDATE profiles SET credit_balance = credit_balance - v_fund_return WHERE id = v_ag.bot_id;
    UPDATE profiles SET credit_balance = credit_balance + v_fund_return WHERE id = v_ag.sponsor_id;
    INSERT INTO transactions (from_id, to_id, amount, type, notes)
    VALUES (v_ag.bot_id, v_ag.sponsor_id, v_fund_return, 'sponsorship_settlement',
            'Return of sponsor-funded credits');
  END IF;

  UPDATE sponsor_agreements SET
    status = 'terminated', terminated_at = now(), terminated_by = p_user_id
  WHERE id = p_agreement_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sponsor_earnings_share', v_sponsor_share,
    'funded_credits_returned', v_fund_return,
    'bot_earnings_kept', v_earnings - v_sponsor_share
  );
END;
$$;

-- Start a bot rental (renter pays first day upfront)
CREATE OR REPLACE FUNCTION start_rental(p_bot_id uuid, p_renter_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_listing    bot_rental_listings%ROWTYPE;
  v_bot        profiles%ROWTYPE;
  v_renter     profiles%ROWTYPE;
  v_owner_id   uuid;
  v_fee        int;
  v_owner_gets int;
  v_rental_id  uuid;
BEGIN
  SELECT * INTO v_listing FROM bot_rental_listings WHERE bot_id = p_bot_id FOR UPDATE;
  IF NOT FOUND OR NOT v_listing.is_available THEN
    RETURN '{"error":"Bot is not available for rent"}'::jsonb;
  END IF;

  SELECT * INTO v_bot FROM profiles WHERE id = p_bot_id;
  IF v_bot.reputation_score < 50 THEN
    RETURN '{"error":"Bot does not meet minimum reputation score of 50"}'::jsonb;
  END IF;

  v_owner_id := v_bot.owner_id;
  IF v_owner_id IS NULL THEN RETURN '{"error":"Bot has no owner"}'::jsonb; END IF;
  IF v_owner_id = p_renter_id THEN RETURN '{"error":"Cannot rent your own bot"}'::jsonb; END IF;

  -- Check for existing active rental
  IF EXISTS (SELECT 1 FROM bot_rentals WHERE bot_id = p_bot_id AND status = 'active') THEN
    RETURN '{"error":"Bot already has an active rental"}'::jsonb;
  END IF;

  SELECT * INTO v_renter FROM profiles WHERE id = p_renter_id;
  v_fee        := ceil(v_listing.daily_rate_aa * 0.05);
  v_owner_gets := v_listing.daily_rate_aa - v_fee;

  IF v_renter.credit_balance < v_listing.daily_rate_aa THEN
    RETURN '{"error":"Insufficient credits for first day rental"}'::jsonb;
  END IF;

  -- Debit renter, credit owner, fee is burned
  UPDATE profiles SET credit_balance = credit_balance - v_listing.daily_rate_aa WHERE id = p_renter_id;
  UPDATE profiles SET credit_balance = credit_balance + v_owner_gets             WHERE id = v_owner_id;

  INSERT INTO transactions (from_id, to_id, amount, fee_amount, type, notes)
  VALUES (p_renter_id, v_owner_id, v_listing.daily_rate_aa, v_fee,
          'rental_payment', format('Bot rental: @%s (day 1)', v_bot.username));

  INSERT INTO bot_rentals (bot_id, owner_id, renter_id, daily_rate_aa, platform_fee_aa, owner_gets_aa)
  VALUES (p_bot_id, v_owner_id, p_renter_id, v_listing.daily_rate_aa, v_fee, v_owner_gets)
  RETURNING id INTO v_rental_id;

  -- Mark listing unavailable while rented
  UPDATE bot_rental_listings SET is_available = false WHERE bot_id = p_bot_id;

  RETURN jsonb_build_object('ok', true, 'rental_id', v_rental_id);
END;
$$;

-- End a rental
CREATE OR REPLACE FUNCTION end_rental(p_rental_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rental bot_rentals%ROWTYPE;
BEGIN
  SELECT * INTO v_rental FROM bot_rentals WHERE id = p_rental_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"Rental not found"}'::jsonb; END IF;
  IF v_rental.status <> 'active' THEN RETURN '{"error":"Rental is not active"}'::jsonb; END IF;
  IF p_user_id <> v_rental.owner_id AND p_user_id <> v_rental.renter_id THEN
    RETURN '{"error":"Not authorized"}'::jsonb;
  END IF;

  UPDATE bot_rentals SET
    status = 'ended', ended_at = now(), ended_by = p_user_id
  WHERE id = p_rental_id;

  -- Re-list the bot as available
  UPDATE bot_rental_listings SET is_available = true WHERE bot_id = v_rental.bot_id;

  RETURN '{"ok":true}'::jsonb;
END;
$$;

-- Submit rental review and update bot reputation score
CREATE OR REPLACE FUNCTION submit_rental_review(
  p_rental_id   uuid,
  p_reviewer_id uuid,
  p_rating      int,
  p_comment     text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rental  bot_rentals%ROWTYPE;
  v_avg_rep numeric;
BEGIN
  SELECT * INTO v_rental FROM bot_rentals WHERE id = p_rental_id;
  IF NOT FOUND THEN RETURN '{"error":"Rental not found"}'::jsonb; END IF;
  IF v_rental.status <> 'ended' THEN RETURN '{"error":"Can only review ended rentals"}'::jsonb; END IF;
  IF v_rental.renter_id <> p_reviewer_id THEN RETURN '{"error":"Only the renter can review"}'::jsonb; END IF;
  IF EXISTS (SELECT 1 FROM rental_reviews WHERE rental_id = p_rental_id) THEN
    RETURN '{"error":"Already reviewed"}'::jsonb;
  END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RETURN '{"error":"Rating must be 1-5"}'::jsonb; END IF;

  INSERT INTO rental_reviews (rental_id, reviewer_id, bot_id, rating, comment)
  VALUES (p_rental_id, p_reviewer_id, v_rental.bot_id, p_rating, p_comment);

  -- Recalculate bot reputation as weighted average with existing score
  SELECT (profiles.reputation_score * 0.7 + (p_rating * 20) * 0.3)
  INTO v_avg_rep
  FROM profiles WHERE id = v_rental.bot_id;

  UPDATE profiles SET reputation_score = round(v_avg_rep, 1) WHERE id = v_rental.bot_id;

  RETURN '{"ok":true}'::jsonb;
END;
$$;

-- Fund a sponsored bot (sponsor sends credits to bot)
CREATE OR REPLACE FUNCTION fund_sponsored_bot(p_agreement_id uuid, p_sponsor_id uuid, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ag sponsor_agreements%ROWTYPE;
BEGIN
  SELECT * INTO v_ag FROM sponsor_agreements WHERE id = p_agreement_id;
  IF NOT FOUND THEN RETURN '{"error":"Agreement not found"}'::jsonb; END IF;
  IF v_ag.status <> 'active' THEN RETURN '{"error":"Agreement is not active"}'::jsonb; END IF;
  IF v_ag.sponsor_id <> p_sponsor_id THEN RETURN '{"error":"Not the sponsor"}'::jsonb; END IF;
  IF p_amount <= 0 THEN RETURN '{"error":"Amount must be positive"}'::jsonb; END IF;

  IF (SELECT credit_balance FROM profiles WHERE id = p_sponsor_id) < p_amount THEN
    RETURN '{"error":"Insufficient credits"}'::jsonb;
  END IF;

  UPDATE profiles SET credit_balance = credit_balance - p_amount WHERE id = p_sponsor_id;
  UPDATE profiles SET credit_balance = credit_balance + p_amount WHERE id = v_ag.bot_id;

  INSERT INTO transactions (from_id, to_id, amount, type, notes)
  VALUES (p_sponsor_id, v_ag.bot_id, p_amount, 'sponsorship_credit', 'Sponsor funding');

  RETURN '{"ok":true}'::jsonb;
END;
$$;
