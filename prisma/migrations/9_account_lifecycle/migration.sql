-- Deactivating an account: set while the owner has switched it off. The
-- account and its listings are hidden until they sign in again.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMPTZ(6);

-- Deleting an account removes the "users" row and everything that hangs off
-- it. Messages were the one table that refused (ON DELETE RESTRICT), so a
-- user who had ever chatted could not be deleted.
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_sender_id_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_recipient_id_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
