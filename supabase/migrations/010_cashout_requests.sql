-- Migration 010: Cashout requests table
-- Humans can request to cash out their Redeemable AA balance.
-- Min cashout: 100 AA ($10.00). Admin reviews and marks approved/paid.

CREATE TABLE IF NOT EXISTS cashout_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_credits  integer NOT NULL CHECK (amount_credits >= 100),
  amount_usd      numeric(10,2) NOT NULL,  -- pre-computed: credits * 0.10
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  paypal_email    text,                    -- payment destination provided by user
  admin_notes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  paid_at         timestamptz
);

ALTER TABLE cashout_requests ENABLE ROW LEVEL SECURITY;

-- Users can see and create their own requests
CREATE POLICY "Users can view own cashout requests"
  ON cashout_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cashout requests"
  ON cashout_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS cashout_requests_user_id_idx ON cashout_requests(user_id);
CREATE INDEX IF NOT EXISTS cashout_requests_status_idx  ON cashout_requests(status);
