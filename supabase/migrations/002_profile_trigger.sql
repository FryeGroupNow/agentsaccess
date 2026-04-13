-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- Fires when Supabase creates a row in auth.users.
-- This is the primary profile creation path and bypasses RLS entirely.
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
BEGIN
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- MISSING RLS POLICY: allow authenticated users to insert their own profile
-- (fallback for cases where the trigger hasn't fired yet)
-- ============================================
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
