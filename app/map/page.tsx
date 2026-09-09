import type { Metadata } from "next";
import MapExperience from "@/components/MapExperience";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { seasonLabel } from "@/lib/season";
import type { Place } from "@/lib/supabase";

const SITE_TITLE = "WhatsNearYou";
const SITE_DESCRIPTION =
  "Find the Ganesh pandals near you across Hyderabad — what's on now, and how long you have left to see it.";

// Ids arrive from forwarded links, so they are untrusted input. Checking
// the shape before it reaches PostgREST means a malformed one returns the
// site's own card instead of a 22P02 (invalid uuid) error, which would
// otherwise take the whole page's metadata down with it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fallback = (): Metadata => ({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/api/og"] },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
});

/**
 * Per-pandal link previews.
 *
 * A forwarded link is how most people arrive at a festival map, and the
 * card someone decides to tap on is built here. This lives on /map rather
 * than / because that is where the map moved when the landing page took
 * the root; "/?place=" still works and redirects here, which a crawler
 * follows, so links shared before the move keep their preview.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = params.place;
  const id = typeof raw === "string" && UUID.test(raw) ? raw : null;
  if (!id || !isSupabaseConfigured()) return fallback();

  // Public columns only — the same explicit list app/api/places uses, for
  // the same reason: verification_status is an internal research field,
  // and a link preview is about as public as a surface gets.
  const { data } = await supabase
    .from("places")
    .select("id,name,area,known_for,theme,starts_at,ends_at,archived_at")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (!data) return fallback();

  const place = data as unknown as Place;
  const timing = seasonLabel(place);
  const title = place.area ? `${place.name} · ${place.area}` : place.name;

  // Timing leads. On a seasonal map "3 days left" is what decides whether
  // someone opens the link at all, and a preview clips after a line or two.
  const description = [timing, place.known_for ?? place.theme ?? SITE_DESCRIPTION]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200);
  const image = `/api/og?place=${encodeURIComponent(place.id)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: place.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function MapPage() {
  return <MapExperience isAdmin={false} />;
}
