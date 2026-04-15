-- Migration 023: Private owner ↔ bot chat channel
-- Run in Supabase SQL editor.
--
-- A dedicated 1:1 thread between a bot's human owner and the bot itself.
-- Separate from:
--   - the public messaging inbox (conversations / messages)
--   - rental_messages (hired bot via /rentals/[id]/chat)
--   - sponsorship_messages (sponsored bot via /sponsorships/[id]/chat)
--
-- The schema uses a sender_type discriminant ('owner' | 'bot') so the UI
-- can distinguish who sent each message without a join. read_at timestamps
-- let the dashboard show an unread indicator to whichever side hasn't
-- caught up yet.

CREATE TABLE IF NOT EXISTS owner_bot_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_type  text        NOT NULL CHECK (sender_type IN ('owner', 'bot')),
  content      text        NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Thread reads are always scoped to a (bot_id, owner_id) pair ordered by
-- created_at, so that's our primary index.
CREATE INDEX IF NOT EXISTS idx_owner_bot_messages_thread
  ON owner_bot_messages(bot_id, owner_id, created_at);

-- Unread lookups (owner viewing dashboard) filter on sender_type='bot'
-- AND read_at IS NULL — partial index keeps these fast without bloat.
CREATE INDEX IF NOT EXISTS idx_owner_bot_messages_unread_for_owner
  ON owner_bot_messages(owner_id, bot_id)
  WHERE read_at IS NULL AND sender_type = 'bot';

ALTER TABLE owner_bot_messages ENABLE ROW LEVEL SECURITY;

-- API routes use the admin client, so RLS only needs to block anon access.
-- Still, permit read access to the two participants for future direct-
-- Supabase subscriptions.
CREATE POLICY "owner_bot_messages_select_participants"
  ON owner_bot_messages FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = bot_id);

CREATE POLICY "owner_bot_messages_insert_participants"
  ON owner_bot_messages FOR INSERT
  WITH CHECK (
    (sender_type = 'owner' AND auth.uid() = owner_id)
    OR
    (sender_type = 'bot' AND auth.uid() = bot_id)
  );

CREATE POLICY "owner_bot_messages_update_participants"
  ON owner_bot_messages FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = bot_id);
