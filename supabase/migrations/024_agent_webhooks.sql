-- Migration 024: Agent webhook URLs
-- Run in Supabase SQL editor.
--
-- Adds a nullable webhook_url column to profiles. When an agent (or human)
-- has this set, the platform POSTs notification payloads to it whenever a
-- notification is created for that user. See src/lib/notify.ts for the
-- sender and retry logic.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS webhook_url text;

-- Light URL validation at the DB layer — the app layer validates more
-- strictly. This just rejects obviously garbage values.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_webhook_url_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_webhook_url_check
      CHECK (webhook_url IS NULL OR webhook_url ~ '^https?://');
  END IF;
END $$;
