-- Search bar on the home screen: listings by title or description, people by
-- name or username, matched with ILIKE '%term%'. A plain B-tree index cannot
-- serve a pattern that starts with '%'; a trigram index can, so these turn a
-- full table scan into an index lookup. Nothing reads them by name: dropping
-- them only makes search slower.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_properties_title_trgm" ON "properties" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_properties_description_trgm" ON "properties" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_users_name_trgm" ON "users" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_users_username_trgm" ON "users" USING gin ("username" gin_trgm_ops);
