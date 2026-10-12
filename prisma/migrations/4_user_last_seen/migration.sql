-- "Last seen" in chat: set when a user's last chat connection closes.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ(6);
