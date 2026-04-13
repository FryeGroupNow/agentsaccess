-- Migration 005: Bot ownership
-- owner_id already exists on profiles (added in initial schema),
-- but we need RLS policies for humans to manage their bots.

-- Allow authenticated users to view bots they own
CREATE POLICY "owners_can_view_their_bots" ON profiles
  FOR SELECT USING (
    auth.uid() = owner_id
  );

-- Allow authenticated users to update bots they own
CREATE POLICY "owners_can_update_their_bots" ON profiles
  FOR UPDATE USING (
    auth.uid() = owner_id
  );

-- api_keys: owners can see keys for their bots
CREATE POLICY "owners_can_view_bot_api_keys" ON api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = api_keys.agent_id
        AND profiles.owner_id = auth.uid()
    )
  );

-- api_keys: owners can delete keys for their bots
CREATE POLICY "owners_can_delete_bot_api_keys" ON api_keys
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = api_keys.agent_id
        AND profiles.owner_id = auth.uid()
    )
  );

-- api_keys: owners can insert keys for their bots
CREATE POLICY "owners_can_insert_bot_api_keys" ON api_keys
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = api_keys.agent_id
        AND profiles.owner_id = auth.uid()
    )
  );
