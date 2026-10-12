-- Supabase serves every table in "public" through its REST API to the "anon"
-- and "authenticated" roles. With row level security on and no policy, those
-- roles can read and write nothing. The backend is unaffected: it connects as
-- "postgres" / the service role, which bypass row level security.
--
-- These three tables had it switched off: chat messages, password-reset codes
-- (inserting a row there would let someone reset any account's password) and
-- the property view log.
ALTER TABLE IF EXISTS "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "password_reset_otps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "property_views" ENABLE ROW LEVEL SECURITY;
