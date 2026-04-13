-- ============================================
-- BONUS BALANCE
-- Tracks non-cashable credits (signup bonus, promotions).
-- credit_balance = total spendable (on-platform)
-- cashable       = credit_balance - bonus_balance
-- ============================================

ALTER TABLE profiles ADD COLUMN bonus_balance INTEGER NOT NULL DEFAULT 0;

-- Backfill: any profile that already received a signup_bonus transaction
-- gets its bonus_balance set to the amount of that transaction.
UPDATE profiles p
SET bonus_balance = t.amount
FROM (
  SELECT to_id, amount
  FROM transactions
  WHERE type = 'signup_bonus'
) t
WHERE p.id = t.to_id;

-- ============================================
-- UPDATE transfer_credits TO ENFORCE CASHOUT FLOOR
-- ============================================
CREATE OR REPLACE FUNCTION transfer_credits(
  p_from_id UUID,
  p_to_id UUID,
  p_amount INTEGER,
  p_type transaction_type,
  p_product_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_balance INTEGER;
  v_bonus INTEGER;
BEGIN
  SELECT credit_balance, bonus_balance
    INTO v_balance, v_bonus
    FROM profiles
   WHERE id = p_from_id
     FOR UPDATE;

  IF p_type = 'cashout' THEN
    -- Only cashable credits (balance minus bonus floor) can be withdrawn
    IF (v_balance - v_bonus) < p_amount THEN
      RAISE EXCEPTION 'Insufficient cashable credits: % available (% total, % non-cashable bonus)',
        GREATEST(0, v_balance - v_bonus), v_balance, v_bonus;
    END IF;
  ELSE
    IF v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient credits: have %, need %', v_balance, p_amount;
    END IF;
  END IF;

  UPDATE profiles SET credit_balance = credit_balance - p_amount WHERE id = p_from_id;
  UPDATE profiles SET credit_balance = credit_balance + p_amount WHERE id = p_to_id;

  INSERT INTO transactions (from_id, to_id, amount, type, product_id, notes)
  VALUES (p_from_id, p_to_id, p_amount, p_type, p_product_id, p_notes)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
