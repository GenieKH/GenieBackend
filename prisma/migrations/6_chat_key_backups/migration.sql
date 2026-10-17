-- PIN-protected chat key backups, released only after the PIN is proven.
-- Wrong tries are counted here, so they survive restarts and deploys.
-- Backups made before this stay in users.backup_* until the app re-saves them.
CREATE TABLE IF NOT EXISTS "chat_key_backups" (
  "user_id" UUID NOT NULL,
  "blob" TEXT NOT NULL,
  "salt" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "verifier" TEXT NOT NULL,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_key_backups_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "chat_key_backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Keep the table out of reach of Supabase's public API roles.
ALTER TABLE "chat_key_backups" ENABLE ROW LEVEL SECURITY;
