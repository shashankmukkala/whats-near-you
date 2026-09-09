-- The map's core entity.
--
-- The one structural difference from the HydCafeMap schema this project
-- is derived from: a place here is TIME-BOUND. A cafe exists until it
-- closes; a Ganesh pandal exists for about ten days a year. Bolting a
-- time dimension onto a schema that assumes permanence is far more
-- painful than starting with one, so `starts_at` / `ends_at` /
-- `archived_at` are here from the first migration and every read path is
-- written against them.
--
-- `season` ("ganesh-2026") is how recurrence is modelled: next year's
-- pandals are NEW ROWS with a new season, not a recurrence rule. That
-- keeps history queryable ("this pandal has run for six years") and keeps
-- the default map query a simple index scan instead of date arithmetic.
-- It is deliberately a plain text column rather than an `occasions`
-- table — v1 is Ganesh pandals only, and a join we would have to design
-- the product around costs more today than the migration to a real table
-- would cost later.
create extension if not exists "pgcrypto";

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,

  -- Neighbourhood/locality, e.g. "Ram Nagar, Secunderabad". This is the
  -- product's primary filter axis and the strongest search vocabulary —
  -- distinct from the full street address below.
  area text,
  address text,

  -- Editorial. `known_for` is the one piece of real writing on the card
  -- (why this pandal matters); `theme` is the concept/decoration for the
  -- current season, which genuinely changes year to year.
  known_for text,
  theme text,

  -- Google's own Maps link, preferred over building a directions URL from
  -- lng/lat: our coordinates are good enough to place a pin but can be
  -- road-level rather than building-level.
  maps_url text,
  -- Instagram / Facebook / reel link from the research sheet. Rendered as
  -- an outbound link, never embedded — these hosts block hotlinking.
  media_url text,
  -- Supabase Storage public URL. Deliberately NOT a base64 data URL in
  -- the row: the reference project stores photos inline and ships every
  -- one of them on every page load, which is fine at 5 photos and not at
  -- 85.
  image_url text,

  -- Vocabulary is generated FROM the data at runtime (see
  -- lib/vocabulary.ts), never from a hardcoded list that can silently
  -- stop matching the rows after an import. That is why there is no CHECK
  -- constraint here: there is no fixed set to constrain it to.
  tags text[] not null default '{}',

  lng double precision not null,
  lat double precision not null,
  -- Where the coordinate came from: 'sheet-decimal', 'sheet-dms'
  -- (converted at import), or 'admin-pin'. Recorded because coordinate
  -- provenance was untraceable in the reference project and 69 of 85 pins
  -- turned out to be wrong.
  coord_source text,

  -- Null means permanent. For a pandal both are set: starts_at is the
  -- festival's first day, ends_at its immersion (end of day, IST).
  starts_at timestamptz,
  ends_at timestamptz,

  -- Last season's pandals are archived, never deleted — they are the
  -- record of how long a pandal has been running, which is exactly the
  -- kind of thing only we would know.
  archived_at timestamptz,
  season text,

  -- INTERNAL RESEARCH FIELD. Whether the operator has personally verified
  -- this record. Must never reach a public payload — enforced twice: the
  -- column grants below keep it out of anon's reach entirely, and
  -- app/api/places selects an explicit column list that omits it.
  verification_status text,

  created_at timestamptz not null default now()
);

-- Sanity guard on coordinates, so a bad import fails loudly at insert
-- time instead of silently placing pins in the sea. Matches the camera's
-- own TELANGANA_BOUNDS in lib/mapStyle.ts, widened slightly.
alter table public.places drop constraint if exists places_coords_check;
alter table public.places add constraint places_coords_check
  check (lng between 77.0 and 81.6 and lat between 15.6 and 20.3);

-- The default map query is "not archived, and not already finished":
--   archived_at is null and (ends_at is null or ends_at >= now())
create index if not exists places_active_idx
  on public.places (archived_at, ends_at, starts_at);
create index if not exists places_season_idx on public.places (season);

alter table public.places enable row level security;

-- Reads are public — the map is the product. Writes never are.
drop policy if exists "places are publicly readable" on public.places;
create policy "places are publicly readable" on public.places
  for select using (true);

drop policy if exists "admins insert places" on public.places;
create policy "admins insert places" on public.places
  for insert with check (public.is_admin());

drop policy if exists "admins update places" on public.places;
create policy "admins update places" on public.places
  for update using (public.is_admin()) with check (public.is_admin());

-- Delete exists for genuine mistakes only. The operational way to retire
-- a pandal is to set archived_at (see the note on the column above).
drop policy if exists "admins delete places" on public.places;
create policy "admins delete places" on public.places
  for delete using (public.is_admin());

-- Column-level privileges: RLS is row-level and cannot hide a column, so
-- keeping `verification_status` (and `coord_source`) out of public reach
-- takes a grant, not a policy.
--
-- A table-level SELECT grant covers every column and cannot be partially
-- revoked, so this revokes the table grant and re-grants the public
-- columns explicitly. Every column the API filters or orders on must be
-- listed here too — PostgREST needs SELECT on a column to use it in a
-- WHERE clause, so omitting archived_at/ends_at would break the default
-- "what's on now" query rather than just hiding a field.
revoke select on public.places from anon;
grant select (
  id, name, area, address, known_for, theme,
  maps_url, media_url, image_url, tags,
  lng, lat, starts_at, ends_at, archived_at, season, created_at
) on public.places to anon;

-- `authenticated` is the admin population in v1 (see 0001) and the admin
-- console needs the internal fields, so it keeps a full table grant.
grant select on public.places to authenticated;
