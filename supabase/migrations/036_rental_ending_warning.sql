-- Migration 036: Rental "ending soon" warning flag
-- Run in Supabase SQL editor.
--
-- Adds a per-rental flag so the platform fires the rental_ending_soon
-- webhook at most once per rental (when < 5 minutes remain). Without
-- this flag, every poll/read would re-fire the warning.

ALTER TABLE bot_rentals
  ADD COLUMN IF NOT EXISTS ending_warning_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS bot_rentals_ending_warning_idx
  ON bot_rentals (expires_at)
  WHERE status = 'active' AND ending_warning_sent = false;
