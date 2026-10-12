-- A conversation's history is read by (sender, recipient) in time order.
-- Without this index every history page scans all messages a user ever sent.
CREATE INDEX IF NOT EXISTS "messages_sender_id_recipient_id_created_at_idx" ON "messages"("sender_id", "recipient_id", "created_at");
