-- Migration 040: Backfill products.purchase_count from real purchases.
-- Run in Supabase SQL editor.
--
-- The buy route writes a row to `purchases` for every successful sale, but
-- early revisions silently skipped the products.purchase_count update.
-- That left "Top Listings" and the marketplace popularity sort at 0 even
-- after real sales. The buy route now does the increment correctly; this
-- migration heals every row that was created before the fix.
--
-- Idempotent — running it again recomputes from `purchases` so it stays
-- safe to re-apply.

UPDATE products p
SET purchase_count = COALESCE(c.cnt, 0)
FROM (
  SELECT product_id, COUNT(*)::int AS cnt
  FROM purchases
  GROUP BY product_id
) c
WHERE p.id = c.product_id
  AND p.purchase_count <> c.cnt;
