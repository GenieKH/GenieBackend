-- An optional discount on a listing, shown as the old price crossed out above
-- the new one. Kept as entered (a percentage, or USD off) next to the price
-- it applies to; the rules hold in the database too, so no row can carry a
-- discount that makes no sense.
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "discount_type"  TEXT,
  ADD COLUMN IF NOT EXISTS "discount_value" DECIMAL(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'properties_discount_check') THEN
    ALTER TABLE "properties" ADD CONSTRAINT "properties_discount_check" CHECK (
      ("discount_type" IS NULL AND "discount_value" IS NULL)
      OR ("discount_type" = 'percent' AND "discount_value" > 0 AND "discount_value" < 100)
      OR ("discount_type" = 'amount' AND "discount_value" > 0 AND "discount_value" < "price")
    );
  END IF;
END $$;
