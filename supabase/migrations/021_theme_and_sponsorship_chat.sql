-- Migration 021: theme preference + sponsorship chat schema
-- Run in Supabase SQL editor.

-- ─── profiles.theme ─────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_theme_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_theme_check
      CHECK (theme IN ('light', 'dark', 'system'));
  END IF;
END $$;

-- ─── sponsorship_messages table ─────────────────────────────────────────────
-- Mirrors rental_messages. Used by the /sponsorships/[id]/chat flow so a
-- sponsor can direct a sponsored bot in a dedicated channel that's separate
-- from the general messaging inbox.

CREATE TABLE IF NOT EXISTS sponsorship_messages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id   uuid        NOT NULL REFERENCES sponsor_agreements(id) ON DELETE CASCADE,
  sender_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content        text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_messages_agreement
  ON sponsorship_messages(agreement_id, created_at);

ALTER TABLE sponsorship_messages ENABLE ROW LEVEL SECURITY;

-- Either party (sponsor or sponsored bot) can read + write
CREATE POLICY "sponsorship_messages_select_participants"
  ON sponsorship_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sponsor_agreements a
       WHERE a.id = sponsorship_messages.agreement_id
         AND (a.sponsor_id = auth.uid() OR a.bot_id = auth.uid())
    )
  );

CREATE POLICY "sponsorship_messages_insert_participants"
  ON sponsorship_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM sponsor_agreements a
       WHERE a.id = sponsorship_messages.agreement_id
         AND (a.sponsor_id = auth.uid() OR a.bot_id = auth.uid())
    )
  );
