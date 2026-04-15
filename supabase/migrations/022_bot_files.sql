-- Migration 022: Secure file sharing for bots
-- Run in Supabase SQL editor.
--
-- Creates a private "bot-files" storage bucket and a bot_files metadata
-- table. Files are scoped to a specific bot and accessible by:
--   * the bot itself (via API key)
--   * the bot's human owner
--   * an active renter during the rental period
--   * an active sponsor during an accepted sponsorship
-- Authorization is enforced at the API layer (all routes use the admin
-- client). The bucket itself is private so direct public URLs don't work —
-- the API returns short-lived signed URLs for downloads.

-- ─── bot_files metadata table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bot_files (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename        text        NOT NULL,
  storage_path    text        NOT NULL UNIQUE,
  content_type    text,
  size_bytes      bigint      NOT NULL DEFAULT 0,
  uploaded_by     uuid        NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_via    text        NOT NULL DEFAULT 'owner'
                  CHECK (uploaded_via IN ('owner', 'self', 'rental', 'sponsorship')),
  rental_id       uuid        REFERENCES bot_rentals(id) ON DELETE SET NULL,
  agreement_id    uuid        REFERENCES sponsor_agreements(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_files_bot      ON bot_files(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_files_uploader ON bot_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_bot_files_rental   ON bot_files(rental_id) WHERE rental_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bot_files_sponsor  ON bot_files(agreement_id) WHERE agreement_id IS NOT NULL;

ALTER TABLE bot_files ENABLE ROW LEVEL SECURITY;

-- The API routes use the service-role admin client for all bot_files
-- operations and enforce authorization in code, so RLS here only has to
-- lock out anon/unauthenticated selects. A permissive select policy for
-- the owner/bot/participant paths is not strictly required because no
-- call ever goes through the browser client, but we still add one for
-- safety / future proofing.

CREATE POLICY "bot_files_select_participants"
  ON bot_files FOR SELECT
  USING (
    auth.uid() = bot_id  -- the bot itself
    OR EXISTS (          -- the bot's owner
      SELECT 1 FROM profiles p
       WHERE p.id = bot_files.bot_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (          -- an active renter
      SELECT 1 FROM bot_rentals r
       WHERE r.bot_id = bot_files.bot_id
         AND r.renter_id = auth.uid()
         AND r.status = 'active'
    )
    OR EXISTS (          -- an active sponsor
      SELECT 1 FROM sponsor_agreements a
       WHERE a.bot_id = bot_files.bot_id
         AND a.sponsor_id = auth.uid()
         AND a.status = 'active'
    )
  );

-- ─── Private storage bucket ────────────────────────────────────────────────
-- The bucket must exist before uploads succeed. Creating it via SQL works in
-- Supabase because storage.buckets is a normal table the service role can
-- write to. If your environment restricts this, create the bucket manually
-- in Supabase Dashboard → Storage → New bucket → name "bot-files" (private).

INSERT INTO storage.buckets (id, name, public)
VALUES ('bot-files', 'bot-files', false)
ON CONFLICT (id) DO NOTHING;
