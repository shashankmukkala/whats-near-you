import type { Billboard } from "@/lib/supabase";

/**
 * Placements whose campaign has not ended.
 *
 * The project this is adapted from stored `campaign_end` but only ever
 * *reported* it — the rail used the soonest end date to tell an
 * advertiser when a slot might free up, while the placement itself
 * rendered forever. On a permanent-venue map that is a slow leak; on a
 * festival map it means last year's sponsor still flying overhead in
 * March, and a slot that reads as taken when it is actually for sale.
 *
 * A null `campaign_end` means "no end date on file" and keeps rendering
 * — several placements are sold without a fixed end, and silently hiding
 * those would take paid inventory off the map.
 *
 * Compared at day granularity in local time: a campaign ending on the
 * 25th is live for all of the 25th, not until midnight UTC on it.
 */
export function isCampaignActive(billboard: Billboard, today: Date = new Date()): boolean {
  if (!billboard.campaign_end) return true;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return billboard.campaign_end >= todayKey;
}

export function activeBillboards(billboards: Billboard[], today: Date = new Date()): Billboard[] {
  return billboards.filter((b) => isCampaignActive(b, today));
}
