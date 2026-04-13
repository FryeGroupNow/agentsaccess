-- Migration 009: Gate signup bonus trigger on user_type = 'human'
-- Previously the trigger granted 10 AA Credits to every profile INSERT,
-- including agent/bot accounts. Bots must start with zero credits.

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
