-- "Logged-in devices". A session is one sign-in on one device. Every refresh
-- replaces the session's token, so each new row copies these columns from the
-- row it replaces, and the one unrevoked row of a session describes it:
-- "created_at" of that row is when the device was last used.
-- Rows from before this have no session and are not listed as devices.
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "session_id" UUID;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "session_started_at" TIMESTAMPTZ(6);
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "device_name" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ip_address" TEXT;
-- Roughly where "ip_address" is, e.g. "Phnom Penh, Cambodia". Null when unknown.
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "location" TEXT;

CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_session_id" ON "refresh_tokens"("session_id");
