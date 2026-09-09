-- Admin identity. This is the ONLY authenticated role in WhatsNearYou v1:
-- there is no public sign-in (no reviews, saves or collections to sign in
-- for), so "authenticated" and "admin" are the same population. Several
-- later migrations rely on that equivalence — notably the column-level
-- grants on `places` in 0002, which let `authenticated` read the internal
-- verification column. If a public sign-in is ever added, revisit 0002
-- before shipping it.
--
-- Membership is granted out-of-band (scripts/create-admin.mjs, service
-- role). There is deliberately no insert/update/delete policy below, so a
-- signed-in user can never add themselves.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A user may check whether they themselves are an admin, and nothing
-- else. The full membership list stays private.
drop policy if exists "users read their own admin row" on public.admins;
create policy "users read their own admin row" on public.admins
  for select using (auth.uid() = user_id);

-- security definer so policies on other tables can call this without
-- being filtered by admins' own RLS above (which would otherwise make the
-- check depend on the caller being able to read the row it is testing).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Self-service admin password recovery. An admin sets two secret 10-digit
-- numbers out-of-band (scripts/set-admin-recovery.mjs); to reset a
-- forgotten password later they re-enter the first 5 and last 5 digits of
-- each. Only a salted hash of the combined 20-digit code is stored — the
-- raw numbers never touch the database (see lib/recoveryCode.ts).
--
-- Deliberately NO row level security policies at all, not even a
-- self-select one: this table is touched only server-side with the
-- service role, from app/api/admin/reset-password and the setup script.
create table if not exists public.admin_recovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_recovery enable row level security;
