-- ============================================
-- MIGRATION 006: Product Files + Starter Credits
-- ============================================

-- 1. Product file/ownership columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_digital_art BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_owner_id UUID REFERENCES profiles(id);

-- 2. Storage bucket policies (run manually if bucket already exists):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-assets', 'product-assets', true)
-- ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to product-assets
-- CREATE POLICY "auth_upload_product_assets" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-assets');
-- CREATE POLICY "public_read_product_assets" ON storage.objects
--   FOR SELECT USING (bucket_id = 'product-assets');

-- 3. Update transfer_credits() to spend Starter AA first
--    When debiting, reduce bonus_balance (Starter) before Redeemable.
--    bonus_balance decreases by min(debit_amount, current_bonus_balance).
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
  v_starter_spent INTEGER;
BEGIN
  SELECT credit_balance, bonus_balance
    INTO v_balance, v_bonus
    FROM profiles
   WHERE id = p_from_id
     FOR UPDATE;

  IF p_type = 'cashout' THEN
    -- Only redeemable credits (balance minus Starter floor) can be withdrawn
    IF (v_balance - v_bonus) < p_amount THEN
      RAISE EXCEPTION 'Insufficient redeemable credits: % AA available (% total, % Starter AA non-cashable)',
        GREATEST(0, v_balance - v_bonus), v_balance, v_bonus;
    END IF;
  ELSE
    IF v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient credits: have % AA, need % AA', v_balance, p_amount;
    END IF;
  END IF;

  -- Spend Starter AA first, then Redeemable
  v_starter_spent := LEAST(v_bonus, p_amount);

  UPDATE profiles
     SET credit_balance = credit_balance - p_amount,
         bonus_balance  = bonus_balance  - v_starter_spent
   WHERE id = p_from_id;

  UPDATE profiles SET credit_balance = credit_balance + p_amount WHERE id = p_to_id;

  INSERT INTO transactions (from_id, to_id, amount, type, product_id, notes)
  VALUES (p_from_id, p_to_id, p_amount, p_type, p_product_id, p_notes)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
