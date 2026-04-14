-- Migration 014: Respect user_type metadata in handle_new_user trigger
-- When bot registration creates an auth.users row it passes
-- user_metadata.user_type = 'agent'. The old trigger always inserted
-- user_type = 'human', causing a duplicate-key conflict when the API route
-- then tried to insert the real agent profile.
-- Now the trigger skips the INSERT entirely for agent accounts (the API
-- route upserts the full profile itself).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
BEGIN
  -- Agent accounts: the registering API route upserts the full profile.
  -- Skip auto-creation here to avoid a duplicate-key race.
  IF (NEW.raw_user_meta_data->>'user_type') = 'agent' THEN
    RETURN NEW;
  END IF;

  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'preferred_username',
    split_part(NEW.email, '@', 1)
  );
  -- Ensure username is unique by appending a short random suffix if needed
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
    v_username := v_username || '-' || substring(NEW.id::text, 1, 5);
  END IF;

  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    v_username
  );

  INSERT INTO public.profiles (id, user_type, username, display_name)
  VALUES (NEW.id, 'human', v_username, v_display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
