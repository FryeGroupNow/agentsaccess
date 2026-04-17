-- Migration 032: Reputation recalculation
--
-- The scoring rules were defined in the UI ("How to build reputation") but
-- never actually enforced in code — profiles still default to 0 forever, even
-- when the user has done all the right things. This migration:
--
--   1. Defines recalculate_reputation(user_id) which returns the score derived
--      from real activity. Keeps scoring rules in one authoritative place.
--   2. Hooks it onto the events that should nudge the score:
--        - a purchase row inserted     (product sale)
--        - a rental_reviews row inserted
--        - a disputes row resolved
--        - a reports row actioned
--      Post likes are not per-row triggered — they'd thrash the table on every
--      heart click — instead we apply them lazily via a batch call the app
--      invokes after like_count updates. We still expose recalculate_reputation
--      so the app can pull the fresh score on demand.
--   3. Backfills every existing profile.
--
-- Run with:  supabase migration up 032_reputation_recalc  (or paste into SQL editor)

-- Score model, taken from the in-app guide ("How to build reputation"):
--   +2  per successful product sale (from `purchases`)
--   +5  per 4–5★ rental review
--   -3  per 1–2★ rental review
--   +1  per 10 likes received on feed posts (cumulative, integer floor)
--   +3  per completed sponsorship (status='terminated', accepted_at IS NOT NULL)
--   +1  per full week of account age (floor((now - created_at)/7d))
--   -5  per refund or partial-refund dispute ruled against the seller
--   -10 per report actioned against this user's post / product / profile
--
-- "Terms of service violation (-20)" is a manual admin action — we don't have a
-- structured table for it. Admins can subtract via admin_notes on a report
-- plus a forced recalculation. If needed, add a moderation_actions table later.

CREATE OR REPLACE FUNCTION recalculate_reputation(p_user_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sales          int := 0;
  v_good_reviews   int := 0;
  v_bad_reviews    int := 0;
  v_total_likes    int := 0;
  v_completed_spon int := 0;
  v_week_age       int := 0;
  v_refund_disputes int := 0;
  v_actioned_reports int := 0;
  v_created_at     timestamptz;
  v_score          numeric;
BEGIN
  SELECT created_at INTO v_created_at FROM profiles WHERE id = p_user_id;
  IF v_created_at IS NULL THEN RETURN 0; END IF;

  -- Product sales (as seller)
  SELECT COUNT(*) INTO v_sales
  FROM purchases pu
  JOIN products  pr ON pr.id = pu.product_id
  WHERE pr.seller_id = p_user_id;

  -- Rental reviews (this user is the bot that was rented)
  SELECT
    COUNT(*) FILTER (WHERE rating >= 4),
    COUNT(*) FILTER (WHERE rating <= 2)
  INTO v_good_reviews, v_bad_reviews
  FROM rental_reviews
  WHERE bot_id = p_user_id;

  -- Likes on this user's top-level posts. Sum the split counts rather than
  -- `like_count` because the latter is only maintained by the legacy
  -- `post_likes` table; new reactions land in `post_reactions`.
  SELECT COALESCE(SUM(GREATEST(like_count, human_like_count + bot_like_count)), 0)
    INTO v_total_likes
  FROM posts
  WHERE author_id = p_user_id
    AND parent_id IS NULL;

  -- Completed sponsorships (the bot was sponsored; agreement reached 'active'
  -- then was terminated). Only counts on the bot side.
  SELECT COUNT(*) INTO v_completed_spon
  FROM sponsor_agreements
  WHERE bot_id = p_user_id
    AND status = 'terminated'
    AND accepted_at IS NOT NULL;

  -- Account age in weeks
  v_week_age := GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - v_created_at)) / (7 * 86400))::int);

  -- Refund/partial-refund disputes against this seller
  SELECT COUNT(*) INTO v_refund_disputes
  FROM disputes
  WHERE seller_id = p_user_id
    AND status IN ('resolved_refund', 'resolved_partial');

  -- Actioned reports targeting this user's content or profile. We include
  -- profile-level and content-level reports, since a single actioned report is
  -- strong signal.
  SELECT COUNT(*) INTO v_actioned_reports
  FROM reports r
  WHERE r.status = 'actioned'
    AND (
      (r.target_type = 'profile' AND r.target_id = p_user_id) OR
      (r.target_type = 'product' AND r.target_id IN (SELECT id FROM products WHERE seller_id = p_user_id)) OR
      (r.target_type = 'post'    AND r.target_id IN (SELECT id FROM posts    WHERE author_id = p_user_id))
    );

  v_score :=
      v_sales            * 2
    + v_good_reviews     * 5
    - v_bad_reviews      * 3
    + floor(v_total_likes / 10)
    + v_completed_spon   * 3
    + v_week_age
    - v_refund_disputes  * 5
    - v_actioned_reports * 10;

  UPDATE profiles
  SET reputation_score = round(v_score, 2),
      updated_at       = now()
  WHERE id = p_user_id;

  RETURN v_score;
END;
$$;

-- ── Triggers that recalculate on the right events ────────────────────────────

CREATE OR REPLACE FUNCTION trg_reputation_from_purchase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_seller uuid;
BEGIN
  SELECT seller_id INTO v_seller FROM products WHERE id = NEW.product_id;
  IF v_seller IS NOT NULL THEN PERFORM recalculate_reputation(v_seller); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reputation_on_purchase ON purchases;
CREATE TRIGGER reputation_on_purchase
  AFTER INSERT ON purchases
  FOR EACH ROW EXECUTE FUNCTION trg_reputation_from_purchase();

-- Rental reviews already have a trigger in migration 015 that tweaks reputation
-- with a weighted average (reputation_score * 0.7 + rating*20 * 0.3). That's
-- the old system and it overwrites our score; replace the function so it uses
-- the new authoritative recalculator instead.

CREATE OR REPLACE FUNCTION submit_rental_review(
  p_rental_id   uuid,
  p_reviewer_id uuid,
  p_rating      int,
  p_comment     text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rental bot_rentals%ROWTYPE;
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

  PERFORM recalculate_reputation(v_rental.bot_id);

  RETURN '{"ok":true}'::jsonb;
END;
$$;

-- Dispute resolution → recalculate the seller's reputation
CREATE OR REPLACE FUNCTION trg_reputation_from_dispute()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IN ('resolved_refund', 'resolved_partial')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM recalculate_reputation(NEW.seller_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reputation_on_dispute ON disputes;
CREATE TRIGGER reputation_on_dispute
  AFTER UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION trg_reputation_from_dispute();

-- Report actioned → recalculate the target's reputation
CREATE OR REPLACE FUNCTION trg_reputation_from_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_target uuid;
BEGIN
  IF NEW.status = 'actioned' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.target_type = 'profile' THEN
      v_target := NEW.target_id;
    ELSIF NEW.target_type = 'product' THEN
      SELECT seller_id INTO v_target FROM products WHERE id = NEW.target_id;
    ELSIF NEW.target_type = 'post' THEN
      SELECT author_id INTO v_target FROM posts WHERE id = NEW.target_id;
    END IF;
    IF v_target IS NOT NULL THEN PERFORM recalculate_reputation(v_target); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reputation_on_report ON reports;
CREATE TRIGGER reputation_on_report
  AFTER UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION trg_reputation_from_report();

-- Sponsorship terminated → recalculate the bot's reputation
CREATE OR REPLACE FUNCTION trg_reputation_from_sponsorship()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'terminated' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM recalculate_reputation(NEW.bot_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reputation_on_sponsorship ON sponsor_agreements;
CREATE TRIGGER reputation_on_sponsorship
  AFTER UPDATE ON sponsor_agreements
  FOR EACH ROW EXECUTE FUNCTION trg_reputation_from_sponsorship();

-- ── One-time backfill ────────────────────────────────────────────────────────

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM profiles LOOP
    PERFORM recalculate_reputation(r.id);
  END LOOP;
END $$;
