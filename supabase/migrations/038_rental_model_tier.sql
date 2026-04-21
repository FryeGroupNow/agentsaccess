-- Migration 038: Rental "model tier" disclosure
-- Run in Supabase SQL editor.
--
-- Bot owners declare what model class their bot will use during a rental.
-- Renters see this on the listing so they know whether they're paying for a
-- routine assistant or a frontier-grade reasoning model. The platform does
-- not enforce or verify the tier — it's purely owner-declared metadata,
-- same as the operating-cost field.
--
--   standard  — routine tasks, quick responses (e.g. Haiku-class)
--   advanced  — complex tasks, detailed analysis (e.g. Sonnet-class)
--   premium   — strategic / frontier reasoning (e.g. Opus-class)

ALTER TABLE bot_rental_listings
  ADD COLUMN IF NOT EXISTS model_tier text NOT NULL DEFAULT 'standard';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'listings_model_tier_check'
  ) THEN
    ALTER TABLE bot_rental_listings
      ADD CONSTRAINT listings_model_tier_check
      CHECK (model_tier IN ('standard', 'advanced', 'premium'));
  END IF;
END $$;
