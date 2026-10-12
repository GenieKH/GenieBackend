-- Personal information, and "username" split into two things:
--   name      what people see; any number of users may share one
--   username  the unique handle: lowercase letters, digits, "_" and "."
-- Until now "username" held the display name. This copies it to "name" and
-- turns every "username" into a unique handle. Safe to run more than once.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sex" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_sex_check') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_sex_check" CHECK ("sex" IN ('male', 'female', 'other'));
  END IF;
END $$;

DO $$
DECLARE
  account RECORD;
  base TEXT;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  -- The unique index is created last, so finding it means this already ran.
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_username_key') THEN
    RETURN;
  END IF;

  UPDATE "users" SET "name" = btrim("username") WHERE "name" IS NULL AND btrim("username") <> '';

  -- Handles are given out oldest account first, starting from none taken, so
  -- when two accounts want the same one the older account gets it.
  CREATE TEMP TABLE "old_usernames" ON COMMIT DROP AS
    SELECT "id", "username", "email", "created_at" FROM "users";
  UPDATE "users" SET "username" = NULL;

  FOR account IN SELECT "id", "username", "email" FROM "old_usernames" ORDER BY "created_at", "id" LOOP
    -- From the old display name, else the part of the email before the "@".
    base := lower(coalesce(nullif(btrim(account.username), ''), split_part(coalesce(account.email, ''), '@', 1)));
    base := left(btrim(regexp_replace(base, '[^a-z0-9_.]+', '_', 'g'), '_.'), 24);
    IF length(base) < 3 THEN
      base := 'user_' || left(replace(account.id::text, '-', ''), 8);
    END IF;

    candidate := base;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM "users" WHERE "username" = candidate) LOOP
      suffix := suffix + 1;
      candidate := base || suffix;
    END LOOP;

    UPDATE "users" SET "username" = candidate WHERE "id" = account.id;
  END LOOP;
END $$;

-- Every new account gets a handle of its own, whichever service creates it.
-- The owner can change it later in the app.
ALTER TABLE "users"
  ALTER COLUMN "username" SET DEFAULT ('user_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
