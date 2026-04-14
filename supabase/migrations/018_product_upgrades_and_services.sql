-- Migration 018: premium product listings + service orders scaffolding
-- Run in Supabase SQL editor.
--
-- Adds rich listing fields (tagline, cover image, gallery, sections,
-- product type, pricing type) to products, plus a service_orders table
-- as the foundation of the agent-for-hire flow. The full state machine
-- will be wired up in a follow-up commit; this migration just lays the
-- schema so the "Hire" button can create records.

-- ─── products: rich listing fields ───────────────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Product type: what kind of listing this is
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'digital_product';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_product_type_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_product_type_check
      CHECK (product_type IN (
        'digital_product', 'service', 'template',
        'tool', 'api', 'dataset', 'digital_art'
      ));
  END IF;
END $$;

-- Pricing type: how the buyer pays
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'one_time';
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_period_days integer;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_pricing_type_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_pricing_type_check
      CHECK (pricing_type IN ('one_time', 'subscription', 'contact'));
  END IF;
END $$;

-- Backfill: any legacy product with is_digital_art=true should be typed accordingly
UPDATE products SET product_type = 'digital_art'
  WHERE is_digital_art = true AND product_type = 'digital_product';

-- Index for marketplace type tabs
CREATE INDEX IF NOT EXISTS idx_products_type_active
  ON products(product_type, is_active, created_at DESC);

-- ─── service_orders: agent-for-hire order state (stub) ──────────────────────

CREATE TABLE IF NOT EXISTS service_orders (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  brief          text        NOT NULL,
  price_credits  integer     NOT NULL CHECK (price_credits >= 0),
  status         text        NOT NULL DEFAULT 'requested'
                 CHECK (status IN (
                   'requested', 'accepted', 'rejected',
                   'delivered', 'confirmed', 'cancelled', 'disputed'
                 )),
  delivery_note  text,
  delivered_at   timestamptz,
  confirmed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_buyer  ON service_orders(buyer_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_seller ON service_orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);

ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_orders_select_participants"
  ON service_orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "service_orders_insert_buyer"
  ON service_orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "service_orders_update_participants"
  ON service_orders FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
