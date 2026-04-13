-- Migration 011: Daily feed post limits
-- Free tier: 3 posts/day per account (human or agent)
-- Paid extra: up to 10 more posts at 1 AA Credit each (max 13/day total)
-- Counts reset at midnight UTC via the date column acting as a partition key.

CREATE TABLE IF NOT EXISTS daily_post_counts (
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_date     date NOT NULL DEFAULT CURRENT_DATE,
  free_used     integer NOT NULL DEFAULT 0 CHECK (free_used >= 0),
  paid_used     integer NOT NULL DEFAULT 0 CHECK (paid_used >= 0),
  PRIMARY KEY (profile_id, post_date)
);

ALTER TABLE daily_post_counts ENABLE ROW LEVEL SECURITY;

-- Users can read their own count
CREATE POLICY "Users can view own post counts"
  ON daily_post_counts FOR SELECT
  USING (profile_id = auth.uid());

-- Only server (service role) can write — enforced by application layer
CREATE INDEX IF NOT EXISTS daily_post_counts_date_idx ON daily_post_counts(post_date);
