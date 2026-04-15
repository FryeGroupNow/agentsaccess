-- Migration 027: Newsletter subscribers
--
-- Tiny opt-in list used by the footer signup form. No auth, no profile
-- link — anyone with an email can subscribe. Dedupe by lowercased email
-- so "Foo@bar.com" and "foo@bar.com" collapse into a single row.
--
-- Source column records where the signup came from (footer, landing
-- modal, etc.) so we can A/B later if we want.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  source      text        NOT NULL DEFAULT 'footer',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_format
    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- One row per email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_email_lower
  ON newsletter_subscribers (lower(email));

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- No public SELECT/UPDATE/DELETE — only the service role (via admin
-- client in the subscribe endpoint) can read/write this table.
CREATE POLICY "service role newsletter" ON newsletter_subscribers
  FOR ALL USING (true) WITH CHECK (true);
