-- Public pandal submissions.
--
-- Fifteen curated pandals is a good demo and a thin map for a city this
-- size — the research sheet itself names four more neighbourhoods with
-- nothing in them yet. The people who know where a pandal is are the
-- people standing next to it, so this opens the listing to them.
--
-- Submissions land in their own table rather than as `places` rows with a
-- status column. That is deliberate: `places` is read by the public map on
-- every load, and one forgotten `.eq("status", "approved")` anywhere would
-- put unreviewed, unverified, potentially abusive content straight onto
-- the map. A separate table cannot leak that way — the map's query does
-- not know it exists. Approving copies the row across.
create table if not exists public.place_submissions (
  id uuid primary key default gen_random_uuid(),

  -- What the submitter tells us.
  name text not null check (char_length(name) between 2 and 160),
  area text check (area is null or char_length(area) <= 120),
  address text check (address is null or char_length(address) <= 400),
  known_for text check (known_for is null or char_length(known_for) <= 1200),
  theme text check (theme is null or char_length(theme) <= 600),
  maps_url text check (maps_url is null or char_length(maps_url) <= 600),
  media_url text check (media_url is null or char_length(media_url) <= 600),
  image_url text check (image_url is null or char_length(image_url) <= 600),

  lng double precision not null,
  lat double precision not null,

  starts_at timestamptz,
  ends_at timestamptz,

  -- How we reach them if something needs checking. Never published: the
  -- column grants below keep it away from anon entirely, the same
  -- mechanism that hides places.verification_status.
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  contact_phone text not null check (char_length(contact_phone) between 6 and 20),

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Set once approved, pointing at the row this became.
  published_place_id uuid references public.places(id) on delete set null,
  review_note text,

  created_at timestamptz not null default now()
);

-- Same guard as places: a bad coordinate fails at insert rather than
-- putting a pin in the sea.
alter table public.place_submissions drop constraint if exists place_submissions_coords_check;
alter table public.place_submissions add constraint place_submissions_coords_check
  check (lng between 77.0 and 81.6 and lat between 15.6 and 20.3);

create index if not exists place_submissions_status_idx on public.place_submissions (status, created_at desc);

alter table public.place_submissions enable row level security;

-- Anyone may submit, but only as 'pending' — nobody can self-approve.
drop policy if exists "anyone can submit a pandal" on public.place_submissions;
create policy "anyone can submit a pandal" on public.place_submissions
  for insert with check (status = 'pending');

-- Reading and acting on the queue is admin-only. Submissions carry a phone
-- number, so an anon read policy here would publish contact details for
-- everyone who ever helped.
drop policy if exists "admins read submissions" on public.place_submissions;
create policy "admins read submissions" on public.place_submissions
  for select using (public.is_admin());

drop policy if exists "admins update submissions" on public.place_submissions;
create policy "admins update submissions" on public.place_submissions
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete submissions" on public.place_submissions;
create policy "admins delete submissions" on public.place_submissions
  for delete using (public.is_admin());

-- Belt and braces on the contact details. RLS already denies anon every
-- SELECT here, but the insert path needs the anon role to hold INSERT on
-- the columns it writes, and a future "let people see pending pandals"
-- policy would otherwise expose phone numbers by accident.
revoke select on public.place_submissions from anon;
grant insert (
  name, area, address, known_for, theme, maps_url, media_url, image_url,
  lng, lat, starts_at, ends_at, contact_name, contact_phone, status
) on public.place_submissions to anon;
