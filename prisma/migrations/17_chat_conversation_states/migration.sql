-- Each person's own archive / "delete for me" state of a conversation.
-- A conversation has no table of its own (it is the messages between two
-- people), so this row is keyed by the person and the other participant.
-- Deleting either account deletes the rows that mention it.
CREATE TABLE IF NOT EXISTS "chat_conversation_states" (
  "user_id"     UUID           NOT NULL,
  "partner_id"  UUID           NOT NULL,
  "archived_at" TIMESTAMPTZ(6),
  "cleared_at"  TIMESTAMPTZ(6),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "chat_conversation_states_pkey" PRIMARY KEY ("user_id", "partner_id"),
  CONSTRAINT "chat_conversation_states_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_conversation_states_partner_id_fkey" FOREIGN KEY ("partner_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_conversation_states_partner_id_idx"
  ON "chat_conversation_states" ("partner_id");

-- Like every table here: closed to Supabase's public REST roles (see 5_).
ALTER TABLE "chat_conversation_states" ENABLE ROW LEVEL SECURITY;
