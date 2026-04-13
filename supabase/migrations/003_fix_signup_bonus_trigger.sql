-- Rewrite grant_signup_bonus so any internal error is caught and logged,
-- never rolling back the profile INSERT that triggered it.
CREATE OR REPLACE FUNCTION grant_signup_bonus()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transactions (to_id, amount, type, notes)
  VALUES (NEW.id, 10, 'signup_bonus', 'Welcome bonus credits');

  UPDATE profiles SET credit_balance = credit_balance + 10 WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but never block profile creation
  RAISE WARNING 'grant_signup_bonus failed for profile %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
