-- ============================================================
-- ADD FIREBASE_UID TO USERS TABLE
-- ============================================================
ALTER TABLE public.users 
ADD COLUMN firebase_uid TEXT UNIQUE;

CREATE INDEX idx_users_firebase_uid ON public.users (firebase_uid) WHERE firebase_uid IS NOT NULL;
