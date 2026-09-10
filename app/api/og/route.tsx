import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isLiveNow, seasonLabel } from "@/lib/season";
import type { Place } from "@/lib/supabase";

/**
 * The image a forwarded link unfurls with.
 *
 * This is generated rather than served as a file because not one of the
 * fifteen pandals has a photo yet — the research sheet carries Instagram
 * links, and those hosts block hotlinking, so there is nothing to point
 * at. A generated card is the difference between a forward that looks
 * like a link and one that looks like a place.
 *
 * When photos do exist, the right change is to composite `image_url`
 * behind this text rather than to replace the card: the name, the area
 * and the countdown are the information, and a photo alone would drop the
 * one fact that decides whether someone opens it.
 *
 * Colours are hardcoded rather than read from globals.css — this renders
 * in Satori, which has no cascade, no custom properties and no stylesheet.
 * They mirror the palette deliberately, which means they have to be
 * updated by hand when it moves: --accent-live went from brass to
 * lamplight when the cover became a painting, and this followed it.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INK = "#1a1713";
const LAMP = "#c2761f";
const PAPER = "#f7f3ec";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("place");
  const id = raw && UUID.test(raw) ? raw : null;

  let place: Place | null = null;
  if (id && isSupabaseConfigured()) {
    const { data } = await supabase
      .from("places")
      .select("id,name,area,known_for,theme,starts_at,ends_at,archived_at")
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle();
    if (data) place = data as unknown as Place;
  }

  const live = place ? isLiveNow(place) : false;
  const timing = place ? seasonLabel(place) : null;
  const accent = live ? LAMP : PAPER;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          // The coral bloom is a radial gradient on the background, not a
          // positioned circle. Satori supports neither `filter` nor
          // `backdrop-filter`, so a circle div renders with a hard edge —
          // it read as a maroon disc sliced off by the frame rather than
          // as the map's aurora, and its rim cut straight through the
          // title. A gradient stop is the only way to get a soft falloff
          // in this renderer.
          backgroundImage: `radial-gradient(circle at 88% 6%, rgba(201,155,69,0.22) 0%, rgba(201,155,69,0.06) 34%, rgba(201,155,69,0) 60%), linear-gradient(150deg, ${INK} 0%, #221d16 55%, #14110d 100%)`,
          backgroundColor: INK,
          color: "#f4fff9",
          fontFamily: "sans-serif",
        }}
      >

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, letterSpacing: 2 }}>
          {/* Absolute URL built from the incoming request rather than a
              hardcoded host: Satori fetches this server-side, so a relative
              path has nothing to resolve against and the mark silently
              vanishes from every preview. */}
          {/* On a cream disc, not bare. The mark is dark linework and this
              card is near-black, so dropped straight on it only the saffron
              swoosh survived — the elephant vanished entirely. The disc is
              the same trick the selected map pin uses. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 999,
              background: PAPER,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={new URL("/logo-mark.png", request.url).toString()} width={52} height={52} alt="" />
          </div>
          <span style={{ color: "rgba(244,255,249,0.72)", fontWeight: 700 }}>WHATSNEARYOU</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {place?.area && (
            <div style={{ fontSize: 34, color: "rgba(244,255,249,0.6)", marginBottom: 14 }}>{place.area}</div>
          )}
          {/* Three steps rather than two. Names in this dataset run from
              "Balapur Ganesh" to "Hyderabad Ka Raja (Team Netaji /
              Warasiguda Youth Ganesh)" — 55 characters — and at a single
              size the long ones overran the card. Satori has no
              `text-overflow`, so clipping is not a fallback: the size has
              to be chosen up front. */}
          <div
            style={{
              display: "flex",
              fontSize: !place ? 88 : place.name.length > 46 ? 56 : place.name.length > 30 ? 72 : 96,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            {place?.name ?? "Ganesh pandals of Hyderabad"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 26px",
              borderRadius: 999,
              border: `2px solid ${accent}`,
              background: live ? "rgba(201,155,69,0.16)" : "rgba(247,243,236,0.07)",
              fontSize: 30,
              fontWeight: 600,
              color: accent,
            }}
          >
            <div style={{ width: 16, height: 16, borderRadius: 999, background: accent }} />
            {timing ?? "Find what's on near you"}
          </div>
          {live && <div style={{ fontSize: 30, color: "rgba(244,255,249,0.55)" }}>Open right now</div>}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // Previews are forwarded far more often than they are regenerated,
      // and the only thing that changes day to day is the countdown — so
      // an hour of caching is safe and keeps a viral forward from hammering
      // the database once per unfurl.
      headers: { "cache-control": "public, max-age=3600, s-maxage=3600" },
    }
  );
}
