-- What people actually search for, including the searches that found
-- nothing — which is the signal worth having. "Begum Bazar" typed forty
-- times against zero results is a pandal to go research, or an area to
-- sell an ad slot in.
--
-- Written only by app/api/search-logs, through the service role: every
-- visitor is anonymous here (v1 has no public sign-in), so there is no
-- user identity to attach and no RLS policy that would let a client read
-- or write this directly. Aggregation is admin-only.
create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists search_logs_created_at_idx on public.search_logs (created_at);
create index if not exists search_logs_query_idx on public.search_logs (lower(query));

-- Enabled with no policies at all: RLS with zero policies denies
-- everything to anon and authenticated, which is exactly right for a
-- service-role-only table.
alter table public.search_logs enable row level security;
