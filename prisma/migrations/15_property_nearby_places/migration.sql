-- The nearest markets, hospitals and schools of a listing tagged near_market,
-- near_hospital or near_school, with the distance and drive time by road, so
-- a buyer sees how near "near" is. Looked up from the map provider when the
-- listing is placed or its tags change, never when it is viewed.
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "nearby_searched_at" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "property_nearby_places" (
  "property_id"       UUID             NOT NULL,
  "category"          TEXT             NOT NULL,
  "rank"              INTEGER          NOT NULL,
  "name"              TEXT             NOT NULL,
  "provider_place_id" TEXT             NOT NULL,
  "lat"               DOUBLE PRECISION NOT NULL,
  "lng"               DOUBLE PRECISION NOT NULL,
  "straight_meters"   INTEGER          NOT NULL,
  "road_meters"       INTEGER,
  "drive_seconds"     INTEGER,
  -- The primary key also serves "a listing's nearby places, in order".
  CONSTRAINT "property_nearby_places_pkey" PRIMARY KEY ("property_id", "category", "rank"),
  CONSTRAINT "property_nearby_places_property_id_fkey" FOREIGN KEY ("property_id")
    REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "property_nearby_places_category_check"
    CHECK ("category" IN ('market', 'hospital', 'school'))
);

-- Like every table here: closed to Supabase's public REST roles (see 5_).
ALTER TABLE "property_nearby_places" ENABLE ROW LEVEL SECURITY;
