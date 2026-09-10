import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HomeCover from "@/components/HomeCover";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isCurrent, SEASON_ENDS_AT, SEASON_STARTS_AT } from "@/lib/season";
import type { Place } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "WhatsNearYou",
  description: "Every Ganesh pandal in Hyderabad, on one map.",
};

const IST = "Asia/Kolkata";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", timeZone: IST });
const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: IST });

/** How many pandals are listed for this season. Read live, not written into the copy. */
async function getTotal() {
  if (!isSupabaseConfigured()) return 0;
  const { data } = await supabase
    .from("places")
    .select("starts_at,ends_at,archived_at")
    .is("archived_at", null);
  return ((data ?? []) as unknown as Place[]).filter((p) => isCurrent(p)).length;
}

/**
 * One screen, and only one screen.
 *
 * This used to be a hero followed by a feature row, a contribute card and
 * a footer — four sections restating in prose what three links do. None of
 * it survived contact with the question "what is this page for". It is for
 * getting someone to the map, and every extra section was another thing to
 * scroll past on the way.
 *
 * The height is set here rather than on <html>: a global `height: 100%`
 * pins every route to the viewport, which is how the map page once
 * rendered its content into a window that had nothing to scroll.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Links shared before the map moved to /map are already out in the world,
  // forwarded and pasted into chats. A crawler follows this too, so those
  // links keep their own preview card.
  const params = await searchParams;
  const place = typeof params.place === "string" ? params.place : null;
  if (place) redirect(`/map?place=${encodeURIComponent(place)}`);

  const total = await getTotal();
  const dates = `${day(SEASON_STARTS_AT)}–${dayMonth(SEASON_ENDS_AT)}`;

  return (
    <main className="h-[100svh] overflow-hidden">
      <HomeCover dates={dates} total={total} />
    </main>
  );
}
