import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, MINUTE } from "@/lib/rateLimit";

/**
 * Pulls coordinates out of a Google Maps link.
 *
 * Pasting a Maps link is how most people already share a place, and it is
 * far more accurate than asking someone to drag a pin on a phone. The
 * catch is that the links people actually share are shortened
 * (maps.app.goo.gl/…), which carry no coordinates at all until the
 * redirect is followed — and a browser cannot follow it, because Google
 * sends no CORS headers. So it happens here.
 *
 * Deliberately not a general URL fetcher: the host allow-list below is
 * what stops this being an open proxy for probing internal addresses.
 */
const ALLOWED_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
]);

/**
 * Coordinates appear in Maps URLs in several shapes, in rough order of
 * trustworthiness:
 *   !3d17.41!4d78.46   the place's own marker — the one we want
 *   /@17.41,78.46,17z  the CAMERA position, which is near the place but
 *                      not the place, so it is only a fallback
 *   ?q=17.41,78.46     an explicit query
 */
function extractCoords(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "resolve-maps-link", 30, MINUTE, "Too many lookups. Try again shortly.");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const raw = typeof body?.url === "string" ? body.url.trim().slice(0, 600) : "";
  if (!raw) return NextResponse.json({ error: "Paste a Google Maps link." }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ error: "That does not look like a link." }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "Only Google Maps links work here." }, { status: 400 });
  }

  // Long links already carry the coordinates.
  const direct = extractCoords(parsed.toString());
  if (direct) return NextResponse.json(direct);

  // Short link: follow it and read the destination. `redirect: "manual"`
  // so we read the Location header ourselves rather than fetching the
  // whole page, and a timeout because a hung request here would otherwise
  // hold the form open indefinitely.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let current = parsed.toString();
    for (let hop = 0; hop < 4; hop++) {
      const res = await fetch(current, { redirect: "manual", signal: controller.signal });
      const next = res.headers.get("location");
      if (!next) break;
      current = next.startsWith("http") ? next : new URL(next, current).toString();
      const found = extractCoords(current);
      if (found) {
        clearTimeout(timer);
        return NextResponse.json(found);
      }
    }
    clearTimeout(timer);
  } catch {
    // fall through to the generic failure below
  }

  return NextResponse.json(
    { error: "Couldn't read a location from that link — drag the pin instead." },
    { status: 422 }
  );
}
