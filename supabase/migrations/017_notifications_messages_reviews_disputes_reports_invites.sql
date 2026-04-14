-- Migration 017: notifications, messages, reviews, disputes, reports, invites, featured products
-- Run in Supabase SQL editor

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  -- types: sale, like, follow, sponsor_offer, rental_request, review,
  --        credits_received, dispute_opened, dispute_resolved, message, report_actioned
  title       text        NOT NULL,
  body        text,
  link        text,
  is_read     boolean     NOT NULL DEFAULT false,
  data        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Service role can insert notifications on behalf of the system
CREATE POLICY "service role insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);

-- ─── Conversations + Messages ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_b   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- enforce consistent ordering: participant_a < participant_b (by UUID string)
  CONSTRAINT participants_ordered CHECK (participant_a::text < participant_b::text),
  UNIQUE (participant_a, participant_b)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON conversations(participant_a);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON conversations(participant_b);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can see conversation"
  ON conversations FOR SELECT
  USING (auth.uid() = participant_a OR auth.uid() = participant_b);

CREATE POLICY "authenticated users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

CREATE POLICY "service role conversations"
  ON conversations FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         text        NOT NULL CHECK (length(trim(content)) > 0),
  is_read         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- participant can read their messages
CREATE POLICY "conversation participants can read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

CREATE POLICY "sender can insert messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

CREATE POLICY "service role messages"
  ON messages FOR ALL USING (true) WITH CHECK (true);

-- ─── Product Reviews ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_reviews (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reviewer_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating          smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text     text,
  seller_response text,
  reviewer_type   text        NOT NULL DEFAULT 'human' CHECK (reviewer_type IN ('human','agent')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at DESC);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read product reviews"
  ON product_reviews FOR SELECT USING (true);

CREATE POLICY "buyers can insert review"
  ON product_reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "seller can update own product reviews (response only)"
  ON product_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND p.seller_id = auth.uid()
    )
  );

CREATE POLICY "service role product reviews"
  ON product_reviews FOR ALL USING (true) WITH CHECK (true);

-- Add rating columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating numeric(3,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count  int NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured   boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS report_count  int NOT NULL DEFAULT 0;

-- Function: recalculate product rating after review insert/update/delete
CREATE OR REPLACE FUNCTION recalculate_product_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_product_id uuid;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products
  SET
    average_rating = (SELECT AVG(rating) FROM product_reviews WHERE product_id = v_product_id),
    review_count   = (SELECT COUNT(*)    FROM product_reviews WHERE product_id = v_product_id)
  WHERE id = v_product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalculate_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION recalculate_product_rating();

-- ─── Disputes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid        NOT NULL REFERENCES products(id),
  buyer_id       uuid        NOT NULL REFERENCES profiles(id),
  seller_id      uuid        NOT NULL REFERENCES profiles(id),
  reason         text        NOT NULL,
  description    text,
  status         text        NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open','resolved_refund','resolved_partial','resolved_denied')),
  refund_amount  int,
  admin_notes    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_disputes_buyer   ON disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller  ON disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_open    ON disputes(status) WHERE status = 'open';

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyer or seller can see their disputes"
  ON disputes FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "buyer can open dispute"
  ON disputes FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "service role disputes"
  ON disputes FOR ALL USING (true) WITH CHECK (true);

-- ─── Reports ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid        NOT NULL REFERENCES profiles(id),
  target_type  text        NOT NULL CHECK (target_type IN ('post','product','profile')),
  target_id    uuid        NOT NULL,
  reason       text        NOT NULL
               CHECK (reason IN ('spam','inappropriate','fraud','impersonation','other')),
  description  text,
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)  -- one report per (reporter, target)
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_pending ON reports(status) WHERE status = 'pending';

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporter can insert"
  ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reporter can see own reports"
  ON reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "service role reports"
  ON reports FOR ALL USING (true) WITH CHECK (true);

-- Add report_count and is_hidden to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS report_count int     NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_hidden    boolean NOT NULL DEFAULT false;

-- Function: auto-hide content at 3 reports
CREATE OR REPLACE FUNCTION increment_report_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.target_type = 'post' THEN
    UPDATE posts
    SET report_count = report_count + 1,
        is_hidden = (report_count + 1 >= 3)
    WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'product' THEN
    UPDATE products
    SET report_count = report_count + 1
    WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_report_count
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION increment_report_count();

-- ─── Referral / Invite System ─────────────────────────────────────────────────

-- Add invite fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code     text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by      uuid REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count  int NOT NULL DEFAULT 0;

-- Generate invite codes for existing profiles
UPDATE profiles
SET invite_code = lower(substring(replace(id::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;

-- Default invite_code on new profiles
ALTER TABLE profiles
  ALTER COLUMN invite_code SET DEFAULT lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

CREATE TABLE IF NOT EXISTS referrals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id     uuid        NOT NULL REFERENCES profiles(id),
  invitee_id     uuid        UNIQUE REFERENCES profiles(id),
  bonus_granted  boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  redeemed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inviter can see their referrals"
  ON referrals FOR SELECT USING (auth.uid() = inviter_id);

CREATE POLICY "service role referrals"
  ON referrals FOR ALL USING (true) WITH CHECK (true);

-- Function: process referral bonus (5 redeemable AA to both parties)
CREATE OR REPLACE FUNCTION process_referral_bonus(p_invitee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inviter_id uuid;
  v_ref_id     uuid;
BEGIN
  -- Find the referral record
  SELECT id, inviter_id INTO v_ref_id, v_inviter_id
  FROM referrals
  WHERE invitee_id = p_invitee_id AND bonus_granted = false;

  IF v_inviter_id IS NULL THEN RETURN; END IF;

  -- Grant 5 redeemable AA to inviter (credit_balance only, not bonus_balance)
  UPDATE profiles SET credit_balance = credit_balance + 5 WHERE id = v_inviter_id;
  INSERT INTO transactions(from_id, to_id, amount, fee_amount, type, notes)
    VALUES (NULL, v_inviter_id, 5, 0, 'signup_bonus', 'Referral bonus — friend joined');

  -- Grant 5 redeemable AA to invitee
  UPDATE profiles SET credit_balance = credit_balance + 5 WHERE id = p_invitee_id;
  INSERT INTO transactions(from_id, to_id, amount, fee_amount, type, notes)
    VALUES (NULL, p_invitee_id, 5, 0, 'signup_bonus', 'Referral bonus — joined via invite');

  -- Mark bonus granted, update inviter referral count
  UPDATE referrals SET bonus_granted = true, redeemed_at = now() WHERE id = v_ref_id;
  UPDATE profiles SET referral_count = referral_count + 1 WHERE id = v_inviter_id;
END;
$$;
