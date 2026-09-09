-- The advertising product. Three formats, one table, discriminated by
-- ad_type:
--
--   rail      5-slot DOM strip at the bottom of the map   ₹1,000
--   billboard three.js panel placed at a coordinate       ₹3,000
--   aircraft  CSS/DOM banner flying across the upper map  ₹3,000
--
-- The aircraft is a DOM overlay rather than a three.js object on purpose:
-- it stays readable at pitch 0, which a 3D banner would not.
--
-- Consolidated into one migration because, unlike the reference this is
-- derived from, the format set is known up front. There, ad_type's CHECK
-- constraint was widened across four migrations and one of them dropped a
-- column expecting a later one to recreate it — which shipped empty, so a
-- clean replay from scratch failed at the last step.
create table if not exists public.billboards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ad_type text not null default 'billboard',
  -- Rail only: which of the five slots. Advertisers pay per slot, so the
  -- unique index below is what actually guarantees they get it.
  slot_number integer,
  image_url text,
  target_url text,
  -- When this placement's campaign ends. Meaningful here in a way it
  -- isn't on a permanent-venue map: a festival sponsorship should expire
  -- with the festival, and the rail uses the soonest end date among full
  -- slots to answer "when does a slot open".
  campaign_end date,
  lng double precision not null,
  lat double precision not null,
  elevation_m double precision default 0,
  width_m double precision default 10,
  height_m double precision default 5,
  heading_deg double precision default 0,
  advertiser_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.billboards drop constraint if exists billboards_ad_type_check;
alter table public.billboards add constraint billboards_ad_type_check
  check (ad_type in ('billboard', 'aircraft', 'rail'));

alter table public.billboards drop constraint if exists billboards_rail_slot_check;
alter table public.billboards add constraint billboards_rail_slot_check
  check (ad_type <> 'rail' or slot_number between 1 and 5);

create unique index if not exists billboards_rail_slot_unique
  on public.billboards (slot_number)
  where ad_type = 'rail';

alter table public.billboards enable row level security;

drop policy if exists "billboards are publicly readable" on public.billboards;
create policy "billboards are publicly readable" on public.billboards
  for select using (true);

drop policy if exists "admins insert billboards" on public.billboards;
create policy "admins insert billboards" on public.billboards
  for insert with check (public.is_admin());

drop policy if exists "admins update billboards" on public.billboards;
create policy "admins update billboards" on public.billboards
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete billboards" on public.billboards;
create policy "admins delete billboards" on public.billboards
  for delete using (public.is_admin());


-- The enquiry inbox behind /advertise. The flow is deliberately manual:
-- public form -> pending row -> admin inbox -> approve/reject -> the
-- admin publishes the placement by hand. Manual publishing is what lets
-- the operator verify payment, creative, dates and destination before
-- anything goes live on the map.
create table if not exists public.ad_enquiries (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null check (char_length(brand_name) between 2 and 120),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact text not null check (char_length(contact) between 5 and 160),
  ad_format text not null default 'map_rail'
    check (ad_format in ('map_rail', 'billboard', 'aircraft')),
  image_url text,
  target_url text,
  payment_proof_url text,
  campaign_start date,
  campaign_end date,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.ad_enquiries enable row level security;

-- Submitting is open to everyone — that is the point of /advertise — but
-- only as `pending`, so nobody can self-approve. Reading is admin-only:
-- these rows carry contact details and a payment-proof URL.
drop policy if exists "anyone can submit ad enquiries" on public.ad_enquiries;
create policy "anyone can submit ad enquiries" on public.ad_enquiries
  for insert with check (status = 'pending');

drop policy if exists "admins read ad enquiries" on public.ad_enquiries;
create policy "admins read ad enquiries" on public.ad_enquiries
  for select using (public.is_admin());

drop policy if exists "admins update ad enquiry status" on public.ad_enquiries;
create policy "admins update ad enquiry status" on public.ad_enquiries
  for update using (public.is_admin()) with check (public.is_admin());
