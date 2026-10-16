-- Home-screen search history: one row per distinct text a user searched,
-- kept 14 days (the service deletes older rows and never returns them).
-- Deleting the account deletes its history.
CREATE TABLE IF NOT EXISTS "search_history" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          UUID        NOT NULL,
  "query"            TEXT        NOT NULL,
  "normalized_query" TEXT        NOT NULL,
  "searched_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "search_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "search_history_user_id_normalized_query_key"
  ON "search_history" ("user_id", "normalized_query");
CREATE INDEX IF NOT EXISTS "search_history_user_id_searched_at_idx"
  ON "search_history" ("user_id", "searched_at" DESC);
CREATE INDEX IF NOT EXISTS "search_history_searched_at_idx"
  ON "search_history" ("searched_at");

-- Like every table here: closed to Supabase's public REST roles (see 5_).
ALTER TABLE "search_history" ENABLE ROW LEVEL SECURITY;
