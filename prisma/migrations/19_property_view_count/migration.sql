-- The view count shown with every listing: how many people opened it.

-- Counting a listing's views. The primary key starts with the user, so it
-- cannot find a listing's views. Without it the count is the same, only slower.
CREATE INDEX IF NOT EXISTS "property_views_property_id_idx"
  ON "property_views" ("property_id");

-- Owners opening their own listing are no longer recorded as views; drop the
-- ones recorded before, so the count holds only other people.
DELETE FROM "property_views" v
  USING "properties" p
  WHERE v."property_id" = p."id" AND v."user_id" = p."user_id";
