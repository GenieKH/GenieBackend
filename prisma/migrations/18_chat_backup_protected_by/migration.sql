-- Chat key backups can now be locked with the account password instead of a
-- backup PIN. A new device needs to know which one to ask for. Every backup
-- made before this was locked with a PIN.
ALTER TABLE "chat_key_backups"
  ADD COLUMN IF NOT EXISTS "protected_by" TEXT NOT NULL DEFAULT 'pin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_key_backups_protected_by_check'
  ) THEN
    ALTER TABLE "chat_key_backups"
      ADD CONSTRAINT "chat_key_backups_protected_by_check"
      CHECK ("protected_by" IN ('pin', 'password'));
  END IF;
END $$;
