-- Migration 035: Bot → owner AA Credit withdrawals
--
-- Lets the human who owns an agent move Redeemable AA from the bot's wallet
-- into their own. No platform fee — this is an internal transfer between
-- accounts the same person already controls.
--
-- Starter AA (bot.bonus_balance) is not transferable. Only the redeemable
-- slice (credit_balance - bonus_balance) can move.

-- Extend the transaction_type enum if it still exists. Earlier migrations
-- (015, 033, 034) insert values like 'rental_payment' and 'sponsorship_credit'
-- into transactions.type without explicit ALTER TYPE calls, which implies the
-- column was either converted to text out-of-band or the enum was extended
-- manually. Guard the ALTER so the migration is safe either way.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    BEGIN
      ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bot_withdrawal';
    EXCEPTION WHEN others THEN
      -- Harmless: the DB may have already converted the column to text, in
      -- which case extending the enum isn't needed.
      NULL;
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION withdraw_bot_credits(
  p_bot_id   uuid,
  p_owner_id uuid,
  p_amount   int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bot         profiles%ROWTYPE;
  v_redeemable  int;
  v_txn_id      uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN '{"error":"Amount must be positive"}'::jsonb;
  END IF;

  -- Lock the bot's row first to avoid concurrent withdrawals racing past
  -- the balance check.
  SELECT * INTO v_bot FROM profiles WHERE id = p_bot_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"Bot not found"}'::jsonb; END IF;
  IF v_bot.user_type <> 'agent' THEN RETURN '{"error":"Target is not a bot"}'::jsonb; END IF;
  IF v_bot.owner_id IS NULL OR v_bot.owner_id <> p_owner_id THEN
    RETURN '{"error":"Not your bot"}'::jsonb;
  END IF;

  v_redeemable := GREATEST(0, COALESCE(v_bot.credit_balance, 0) - COALESCE(v_bot.bonus_balance, 0));
  IF v_redeemable < p_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient redeemable balance',
                              'available', v_redeemable);
  END IF;

  -- credit_balance moves; bonus_balance (Starter AA) untouched. That keeps
  -- Starter AA non-transferable as required.
  UPDATE profiles SET credit_balance = credit_balance - p_amount WHERE id = p_bot_id;
  UPDATE profiles SET credit_balance = credit_balance + p_amount WHERE id = p_owner_id;

  INSERT INTO transactions (from_id, to_id, amount, fee_amount, type, notes)
  VALUES (p_bot_id, p_owner_id, p_amount, 0, 'bot_withdrawal',
          format('Owner withdrawal from @%s', v_bot.username))
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'ok', true,
    'amount', p_amount,
    'transaction_id', v_txn_id,
    'bot_remaining_redeemable', v_redeemable - p_amount
  );
END;
$$;
