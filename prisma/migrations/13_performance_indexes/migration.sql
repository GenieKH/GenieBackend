-- Indexes for the hottest reads. Safe to apply before or after the code that
-- uses them: without them every query gives the same answer, only slower.

-- Chat list: jumps from one person who wrote to the user to the next
-- ("skip scan" in ChatService.getConversations) instead of reading every
-- message they ever received.
CREATE INDEX IF NOT EXISTS "messages_recipient_id_sender_id_idx"
  ON "messages" ("recipient_id", "sender_id");

-- Map: published listings inside a box (PropertyQueryService.searchMap).
CREATE INDEX IF NOT EXISTS "properties_status_lat_lng_idx"
  ON "properties" ("status", "lat", "lng");

-- The favorite count shown with every listing. The primary key starts with
-- the user, so it cannot find a listing's favorites.
CREATE INDEX IF NOT EXISTS "property_favorites_property_id_idx"
  ON "property_favorites" ("property_id");
