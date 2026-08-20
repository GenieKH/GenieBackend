-- ============================================================
-- USERS TABLE (custom identity, NOT auth.users)
-- ============================================================
create table public.users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  email text unique,
  password_hash text not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),

  constraint users_phone_or_email_check check (
    phone is not null or email is not null
  )
);

create index idx_users_phone on public.users (phone) where phone is not null;
create index idx_users_email on public.users (email) where email is not null;

-- ============================================================
-- REFRESH_TOKENS TABLE
-- ============================================================
create table public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  device_id text,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_refresh_tokens_user_id on public.refresh_tokens (user_id);
create index idx_refresh_tokens_expires_at on public.refresh_tokens (expires_at);

-- ============================================================
-- RLS — enabled, but permissive (service role bypasses anyway)
-- ============================================================
alter table public.users enable row level security;
alter table public.refresh_tokens enable row level security;

-- Deny-by-default for anon/authenticated roles.
-- No policies are created, so PostgREST/anon/authenticated clients
-- get zero rows/writes. Your NestJS backend uses the service_role
-- key, which bypasses RLS entirely regardless of policies below.

-- If you ever want the anon/authenticated Supabase client keys to
-- have zero access (recommended, since Nest owns everything), you
-- can stop here — no policies needed for "deny all".

-- Optional: if some other Supabase-key-based client also needs to
-- hit these tables directly later, add explicit permissive policies
-- like the one below (currently NOT applied):
-- create policy "service role full access" on public.users
--   for all using (true) with check (true);
