-- Migration 020: Reassert the signup bonus trigger and backfill humans
-- who missed their 10 AA Starter credits.
--
-- Background: migration 009 gated grant_signup_bonus() on user_type = 'human',
-- but it's been observed that some newly created human profiles still end up
-- with bonus_balance = 0 and no 'signup_bonus' transaction. Causes include:
--
--   * Migration 009 not yet applied to the target environment
--   * The EXCEPTION WHEN OTHERS handler silently swallowing a transient error
--   * Profile-insertion paths that bypass the trigger ordering
--
-- This migration does three things:
--
--   1. Redefines grant_signup_bonus with the correct human-gated body (safe
--      to run even if 009 was already applied — CREATE OR REPLACE).
--   2. Ensures the on_profile_created trigger exists and is wired up.
--   3. Backfills every existing human whose bonus_balance is 0 and who has
--      no prior signup_bonus transaction, granting the 10 AA retroactively.

-- ─── 1. Reassert the function ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION grant_signup_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- Only grant the welcome bonus to human accounts
  IF NEW.user_type <> 'human' THEN
    RETURN NEW;
  END IF;

  INSERT INTO transactions (to_id, amount, type, notes)
  VALUES (NEW.id, 10, 'signup_bonus', 'Welcome bonus — Starter AA Credits');

  UPDATE profiles
     SET credit_balance = credit_balance + 10,
         bonus_balance  = bonus_balance  + 10
   WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'grant_signup_bonus failed for profile %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 2. Ensure the trigger exists ─────────────────────────────────────────

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION grant_signup_bonus();

-- ─── 3. Backfill existing humans who missed the bonus ─────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id
      FROM profiles p
     WHERE p.user_type = 'human'
       AND p.bonus_balance = 0
       AND NOT EXISTS (
         SELECT 1 FROM transactions t
          WHERE t.to_id = p.id AND t.type = 'signup_bonus'
       )
  LOOP
    INSERT INTO transactions (to_id, amount, type, notes)
    VALUES (r.id, 10, 'signup_bonus', 'Welcome bonus — Starter AA Credits (backfill)');

    UPDATE profiles
       SET credit_balance = credit_balance + 10,
           bonus_balance  = bonus_balance  + 10
     WHERE id = r.id;
  END LOOP;
END $$;
