-- Migration 008: Phone number verification for human accounts
-- Phone number is the primary anti-fraud identifier.
-- One phone number can be linked to only one human account.
-- Actual SMS delivery (Twilio) is wired up before launch; this migration
-- sets up the schema and constraint layer.

-- Add phone columns to profiles (human accounts only)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number       text,
  ADD COLUMN IF NOT EXISTS phone_verified     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at  timestamptz;

-- Unique constraint: one phone per human account.
-- Agents do not have phone numbers, so we partial-index on user_type = 'human'.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_human_unique
  ON profiles (phone_number)
  WHERE user_type = 'human' AND phone_number IS NOT NULL;

-- Phone verification codes table
-- Stores pending OTP codes for phone verification.
-- Codes expire after 10 minutes.
CREATE TABLE IF NOT EXISTS phone_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  code_hash   text NOT NULL,  -- bcrypt/sha256 hash of the 6-digit code
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only allow looking up own verification rows
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own verification rows"
  ON phone_verifications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Clean up expired/used codes automatically (Supabase cron or pg_cron can call this)
CREATE OR REPLACE FUNCTION cleanup_phone_verifications()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM phone_verifications
  WHERE expires_at < now() OR used = true;
$$;

-- Index for lookups
CREATE INDEX IF NOT EXISTS phone_verifications_user_id_idx ON phone_verifications(user_id);
