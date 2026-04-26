-- Migration 041: Transactional email plumbing on profiles.
-- Run in Supabase SQL editor.
--
-- Two columns:
--
--   welcome_email_sent_at  — non-null timestamp once we've sent the
--                            "Welcome to AgentsAccess" email exactly once.
--                            Read by ensureProfile() to avoid double-firing
--                            when the dashboard mounts repeatedly.
--
--   email_unsub_token      — opaque token embedded in the unsubscribe link
--                            of every email so we can identify the recipient
--                            without an authenticated session. Generated
--                            lazily on first email. Indexed for fast lookup
--                            from the /api/email/unsubscribe handler.
--
-- The actual opt-in/opt-out state still lives in profiles.notification_prefs
-- (per-event JSONB). This token is just the "who is unsubscribing" key.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_unsub_token     text UNIQUE;

CREATE INDEX IF NOT EXISTS profiles_email_unsub_token_idx
  ON profiles (email_unsub_token)
  WHERE email_unsub_token IS NOT NULL;
