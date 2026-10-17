-- Everything the add-property form asks, stored so listings can be shown in
-- full, edited later and filtered on the map. Each detail is its own typed,
-- nullable column: a property type only fills the ones its form shows (the
-- service clears the rest), and filters can index them.
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "listing_type"           TEXT,
  ADD COLUMN IF NOT EXISTS "title_type"             TEXT,
  ADD COLUMN IF NOT EXISTS "contact_phone"          TEXT,
  ADD COLUMN IF NOT EXISTS "floors"                 INTEGER,
  ADD COLUMN IF NOT EXISTS "floor_number"           INTEGER,
  ADD COLUMN IF NOT EXISTS "total_units"            INTEGER,
  ADD COLUMN IF NOT EXISTS "has_parking"            BOOLEAN,
  ADD COLUMN IF NOT EXISTS "has_balcony"            BOOLEAN,
  ADD COLUMN IF NOT EXISTS "furnishing"             TEXT,
  ADD COLUMN IF NOT EXISTS "building_type"          TEXT,
  ADD COLUMN IF NOT EXISTS "completion_status"      TEXT,
  ADD COLUMN IF NOT EXISTS "view_type"              TEXT,
  ADD COLUMN IF NOT EXISTS "maintenance_fee"        DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "developer_name"         TEXT,
  ADD COLUMN IF NOT EXISTS "project_name"           TEXT,
  ADD COLUMN IF NOT EXISTS "project_type"           TEXT,
  ADD COLUMN IF NOT EXISTS "monthly_rent"           DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "lease_remaining_months" INTEGER,
  ADD COLUMN IF NOT EXISTS "equipment_included"     TEXT,
  ADD COLUMN IF NOT EXISTS "reason_for_selling"     TEXT;

-- Map filters: published listings of one type, or one listing type, inside
-- the visible box (PropertyQueryService.searchMap).
CREATE INDEX IF NOT EXISTS "properties_status_property_type_lat_lng_idx"
  ON "properties" ("status", "property_type", "lat", "lng");
CREATE INDEX IF NOT EXISTS "properties_status_listing_type_lat_lng_idx"
  ON "properties" ("status", "listing_type", "lat", "lng");

-- The features a listing can be tagged with. A new one is a new row here
-- (and a label in the app), never a schema change.
CREATE TABLE IF NOT EXISTS "keywords" (
  "code" TEXT NOT NULL,
  CONSTRAINT "keywords_pkey" PRIMARY KEY ("code")
);

INSERT INTO "keywords" ("code") VALUES
  ('road_access'),
  ('corner_land'),
  ('near_market'),
  ('near_school'),
  ('near_hospital'),
  ('river_lake_nearby'),
  ('electricity_ready'),
  ('water_supply'),
  ('residential_area'),
  ('commercial_area')
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "property_keywords" (
  "property_id" UUID NOT NULL,
  "keyword"     TEXT NOT NULL,
  CONSTRAINT "property_keywords_pkey" PRIMARY KEY ("property_id", "keyword"),
  CONSTRAINT "property_keywords_property_id_fkey" FOREIGN KEY ("property_id")
    REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "property_keywords_keyword_fkey" FOREIGN KEY ("keyword")
    REFERENCES "keywords"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- The primary key finds a listing's keywords; this finds the listings that
-- have a keyword (filtering by feature).
CREATE INDEX IF NOT EXISTS "property_keywords_keyword_property_id_idx"
  ON "property_keywords" ("keyword", "property_id");

-- Like every table here: closed to Supabase's public REST roles (see 5_).
ALTER TABLE "keywords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_keywords" ENABLE ROW LEVEL SECURITY;
