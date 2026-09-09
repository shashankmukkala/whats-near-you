-- Retires the 3D billboard, leaving two advertising formats:
--
--   rail      5-slot strip at the bottom of the map   ₹1,000
--   aircraft  banner flown across the upper map       ₹3,000
--
-- The billboard was a three.js object placed at a coordinate, and it was
-- the weakest of the three on this product: the map opens flat (tilt makes
-- clustered pins occlude each other), and a 3D panel viewed at pitch 0 is
-- a flat rectangle with none of the presence it was sold for. The aircraft
-- banner was always a DOM overlay for exactly that reason.
--
-- Narrowing a CHECK constraint fails loudly if any row still uses the
-- retired value, which is the behaviour we want — no silent orphans. This
-- runs clean today because no billboard was ever published.
do $$
declare
  stragglers integer;
begin
  select count(*) into stragglers from public.billboards where ad_type = 'billboard';
  if stragglers > 0 then
    raise exception
      'Cannot retire the billboard format: % placement(s) still use it. Convert or delete them first.', stragglers;
  end if;
end $$;

alter table public.billboards drop constraint if exists billboards_ad_type_check;
alter table public.billboards add constraint billboards_ad_type_check
  check (ad_type in ('aircraft', 'rail'));

-- Neither surviving format has a physical size or bearing: the rail is a
-- fixed DOM slot, and the aircraft banner's dimensions come from its own
-- CSS. These four columns described the 3D panel's geometry and nothing
-- else reads them.
--
-- Dropped rather than left in place because the table is empty, so there
-- is no data to lose and no ambiguity about whether they still mean
-- anything. (The general rule in this project is the opposite — see the
-- note in 0002 about never dropping a column and expecting a later
-- migration to recreate it. That rule is about columns holding data.)
alter table public.billboards drop column if exists elevation_m;
alter table public.billboards drop column if exists width_m;
alter table public.billboards drop column if exists height_m;
alter table public.billboards drop column if exists heading_deg;

-- The public enquiry form no longer offers it either.
alter table public.ad_enquiries drop constraint if exists ad_enquiries_ad_format_check;
alter table public.ad_enquiries add constraint ad_enquiries_ad_format_check
  check (ad_format in ('map_rail', 'aircraft'));

-- Re-grant the narrowed column set to anon. The map reads billboards
-- publicly, and a grant naming a dropped column would be stale.
grant select on public.billboards to anon;
