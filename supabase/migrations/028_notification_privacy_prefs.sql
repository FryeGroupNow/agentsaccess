-- Migration 028: Notification + privacy preference columns on profiles.
--
-- Both are JSONB with sensible defaults so existing rows keep working.
-- The keys inside each object mirror the UI toggles in the Account
-- Settings panel. Adding/removing keys later is safe because the app
-- reads with ?? fallback and merges on write.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "new_messages": true,
    "product_sales": true,
    "dispute_updates": true,
    "review_replies": true,
    "sponsor_activity": true,
    "system_announcements": true
  }'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_prefs jsonb NOT NULL DEFAULT '{
    "public_profile": true,
    "allow_messages": true,
    "show_transactions": false,
    "searchable_posts": true
  }'::jsonb;
