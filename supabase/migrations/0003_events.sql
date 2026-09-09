-- City news: festival announcements, laddu auction timings, immersion
-- procession routes, road closures. Admin-curated and deliberately NOT
-- map-pinned — it feeds the ticker across the top of the map and the News
-- panel, nothing more. Anything that belongs at a coordinate is a
-- `places` row instead.
--
-- The table keeps the neutral name `events` because that is what it is;
-- the product surface calls it News.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  location text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists events_date_idx on public.events (event_date);

alter table public.events enable row level security;

-- Public read, admin-only write. The reference project carried
-- `with check (true)` here from its pre-auth MVP for months, which meant
-- anyone holding the anon key — it ships in every browser that loads the
-- site — could broadcast arbitrary text across the top of the map.
drop policy if exists "events are publicly readable" on public.events;
create policy "events are publicly readable" on public.events
  for select using (true);

drop policy if exists "admins insert events" on public.events;
create policy "admins insert events" on public.events
  for insert with check (public.is_admin());

drop policy if exists "admins update events" on public.events;
create policy "admins update events" on public.events
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete events" on public.events;
create policy "admins delete events" on public.events
  for delete using (public.is_admin());
