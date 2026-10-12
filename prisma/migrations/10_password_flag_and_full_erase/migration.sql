-- Whether the account has a password its owner chose. An account made by
-- Google sign-in has none (its "password_hash" is a value nobody can match)
-- until the owner creates one in the app. Safe to run more than once.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_password" BOOLEAN NOT NULL DEFAULT false;

-- An account without a Google identity can only have been made with a password.
UPDATE "users" SET "has_password" = true WHERE "firebase_uid" IS NULL AND "has_password" = false;

-- Deleting an account removes every trace of it. Contact requests it sent to
-- other people's listings used to stay behind, with its name, email and phone
-- (ON DELETE SET NULL).
ALTER TABLE "property_contacts" DROP CONSTRAINT IF EXISTS "property_contacts_user_id_fkey";
ALTER TABLE "property_contacts" ADD CONSTRAINT "property_contacts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
