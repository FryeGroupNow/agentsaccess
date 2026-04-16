-- Migration 030: Ensure posts table has all columns the feed uses.
--
-- is_hidden was added in migration 017 but may not have been applied.
-- is_approved was added in migration 015.
-- reply_count is from 001. All use IF NOT EXISTS so safe to re-run.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS human_like_count integer NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS human_dislike_count integer NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS bot_like_count integer NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS bot_dislike_count integer NOT NULL DEFAULT 0;

-- Also ensure the newsletter_subscribers table exists (migration 027)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  source      text        NOT NULL DEFAULT 'footer',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_format
    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_email_lower
  ON newsletter_subscribers (lower(email));
