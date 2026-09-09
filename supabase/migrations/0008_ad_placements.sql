-- Reshapes advertising around where an ad is SEEN rather than what it is
-- made of.
--
-- Before: rail and aircraft — two rendering techniques, priced by novelty.
-- After: map and card — two audiences, priced by size.
--
--   map   the sponsored slots along the bottom of the map. Everyone
--         browsing sees these.        ₹500 / 2 days / 5 slots
--   card  inside a pandal's detail card. Only people who opened that
--         pandal.                      ₹200 / 2 days / 3 slots
--
-- The aircraft banner goes. It was the most fun thing here and the least
-- defensible: a banner flying across the map is an interruption, it has no
-- natural inventory limit (so nothing to sell scarcity on), and it competes
-- with the pins for the one thing the page is for. Nothing has been sold,
-- so nothing is lost.
--
-- Fails loudly rather than silently orphaning rows, as in 0006.
do $$
declare
  strays integer;
begin
  select count(*) into strays from public.billboards where ad_type not in ('rail', 'aircraft', 'map', 'card');
  if strays > 0 then
    raise exception 'Unexpected ad_type values on % row(s) — inspect before migrating.', strays;
  end if;
end $$;

alter table public.billboards drop constraint if exists billboards_ad_type_check;
alter table public.billboards drop constraint if exists billboards_rail_slot_check;
drop index if exists billboards_rail_slot_unique;

-- Rail was the map placement under another name, so it carries over.
update public.billboards set ad_type = 'map' where ad_type = 'rail';
delete from public.billboards where ad_type = 'aircraft';

alter table public.billboards add constraint billboards_ad_type_check
  check (ad_type in ('map', 'card'));

-- Both placements have finite inventory, and that is the product: an
-- advertiser is buying one of five, not "some space". Enforced by a unique
-- index rather than by application code, because two people paying for slot
-- 3 is the one failure that costs real money and real trust.
alter table public.billboards drop constraint if exists billboards_slot_check;
alter table public.billboards add constraint billboards_slot_check
  check (
    (ad_type = 'map' and slot_number between 1 and 5)
    or (ad_type = 'card' and slot_number between 1 and 3)
  );

create unique index if not exists billboards_placement_slot_unique
  on public.billboards (ad_type, slot_number);

-- Every placement is sold as a window, so both ends are known. campaign_end
-- already existed; this adds the start it was always implicitly paired with.
alter table public.billboards add column if not exists campaign_start date;

-- The enquiry form offers the same two placements.
alter table public.ad_enquiries drop constraint if exists ad_enquiries_ad_format_check;
update public.ad_enquiries set ad_format = 'map' where ad_format in ('map_rail', 'billboard');
update public.ad_enquiries set ad_format = 'card' where ad_format = 'aircraft';
alter table public.ad_enquiries add constraint ad_enquiries_ad_format_check
  check (ad_format in ('map', 'card'));

-- What the advertiser paid, recorded at submission time. Reading the price
-- off the current config months later would misreport anyone who bought
-- before a price change.
alter table public.ad_enquiries add column if not exists amount_inr integer;

grant select on public.billboards to anon;
