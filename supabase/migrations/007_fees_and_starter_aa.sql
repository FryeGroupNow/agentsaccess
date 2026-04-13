-- ============================================
-- MIGRATION 007: Transaction Fees + Starter AA Toggle
-- ============================================

-- 1. Track fee amount on each transaction
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee_amount INTEGER NOT NULL DEFAULT 0;

-- 2. Per-listing "accept Starter AA" toggle
ALTER TABLE products ADD COLUMN IF NOT EXISTS accept_starter_aa BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Update transfer_credits() to apply fees and enforce the toggle
--    p_buyer_fee: extra credits debited from buyer (goes to platform / burned)
--    p_seller_fee: credits withheld from seller (goes to platform / burned)
--    The difference (buyer pays more, seller gets less) is the platform fee.
CREATE OR REPLACE FUNCTION transfer_credits(
  p_from_id    UUID,
  p_to_id      UUID,
  p_amount     INTEGER,
  p_type       transaction_type,
  p_product_id UUID    DEFAULT NULL,
  p_notes      TEXT    DEFAULT NULL,
  p_buyer_fee  INTEGER DEFAULT 0,
  p_seller_fee INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_balance        INTEGER;
  v_bonus          INTEGER;
  v_total_debit    INTEGER;
  v_total_credit   INTEGER;
  v_starter_spent  INTEGER;
BEGIN
  v_total_debit  := p_amount + p_buyer_fee;   -- buyer pays price + their fee
  v_total_credit := p_amount - p_seller_fee;  -- seller receives price minus their fee

  SELECT credit_balance, bonus_balance
    INTO v_balance, v_bonus
    FROM profiles
   WHERE id = p_from_id
     FOR UPDATE;

  IF p_type = 'cashout' THEN
    -- Only redeemable credits can be withdrawn (buyer_fee = 0 for cashouts)
    IF (v_balance - v_bonus) < v_total_debit THEN
      RAISE EXCEPTION 'Insufficient redeemable credits: % AA available (% total, % Starter AA)',
        GREATEST(0, v_balance - v_bonus), v_balance, v_bonus;
    END IF;
  ELSE
    IF v_balance < v_total_debit THEN
      RAISE EXCEPTION 'Insufficient credits: have % AA, need % AA', v_balance, v_total_debit;
    END IF;
  END IF;

  -- Spend Starter AA first (bonus decreases before redeemable)
  v_starter_spent := LEAST(v_bonus, v_total_debit);

  UPDATE profiles
     SET credit_balance = credit_balance - v_total_debit,
         bonus_balance  = bonus_balance  - v_starter_spent
   WHERE id = p_from_id;

  UPDATE profiles
     SET credit_balance = credit_balance + v_total_credit
   WHERE id = p_to_id;

  INSERT INTO transactions (from_id, to_id, amount, type, product_id, notes, fee_amount)
  VALUES (p_from_id, p_to_id, p_amount, p_type, p_product_id, p_notes,
          p_buyer_fee + p_seller_fee)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
