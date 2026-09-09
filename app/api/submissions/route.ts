import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";
import { enforceRateLimit, HOUR } from "@/lib/rateLimit";
import { CURRENT_SEASON, SEASON_ENDS_AT, SEASON_STARTS_AT } from "@/lib/season";

const BOUNDS = { minLng: 77.0, maxLng: 81.6, minLat: 15.6, maxLat: 20.3 };

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Public submission. Anonymous by necessity — the whole point is that
 * somebody standing next to a pandal can add it without an account.
 *
 * That makes this the most abusable route in the app, so it is the most
 * constrained: rate limited per IP, every field length-capped, coordinates
 * checked against Telangana before they reach the database, and the row
 * forced to 'pending' regardless of what the client sends.
 */
export async function POST(request: NextRequest) {
  // A person adds one pandal, occasionally three. Ten an hour is far more
  // than genuine use and far less than a script wants.
  const limited = enforceRateLimit(
    request,
    "place-submission",
    10,
    HOUR,
    "You have submitted several pandals already. Please try again later."
  );
  if (limited) return limited;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Submissions require the database to be configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const name = clean(body.name, 160);
  const contact_phone = clean(body.contact_phone, 20);
  const lng = Number(body.lng);
  const lat = Number(body.lat);

  if (name.length < 2) {
    return NextResponse.json({ error: "Give the pandal a name." }, { status: 400 });
  }
  // Loose on shape, strict on length: Indian numbers get written with
  // +91, spaces, dashes and leading zeroes, and rejecting a real number
  // because of a space is a worse failure than accepting a malformed one
  // an admin will see anyway.
  if (contact_phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Enter a contact phone number we can reach you on." }, { status: 400 });
  }
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json({ error: "Drop a pin on the map so people can find it." }, { status: 400 });
  }
  if (lng < BOUNDS.minLng || lng > BOUNDS.maxLng || lat < BOUNDS.minLat || lat > BOUNDS.maxLat) {
    return NextResponse.json({ error: "That location is outside Telangana." }, { status: 400 });
  }

  const { error } = await supabase.from("place_submissions").insert({
    name,
    area: clean(body.area, 120) || null,
    address: clean(body.address, 400) || null,
    known_for: clean(body.known_for, 1200) || null,
    theme: clean(body.theme, 600) || null,
    maps_url: clean(body.maps_url, 600) || null,
    media_url: clean(body.media_url, 600) || null,
    image_url: clean(body.image_url, 600) || null,
    lng,
    lat,
    starts_at: SEASON_STARTS_AT,
    ends_at: SEASON_ENDS_AT,
    contact_name: clean(body.contact_name, 120) || null,
    contact_phone,
    // Forced, never taken from the client. The RLS policy enforces this
    // too; both exist because either one alone is a single point of
    // failure on the route that lets strangers write to the map.
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** The admin review queue. */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json([]);

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.client
    .from("place_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * Approve or reject. Approving COPIES the submission into `places` rather
 * than flipping a flag, which is what keeps unreviewed content structurally
 * incapable of reaching the map: the map's query has no knowledge of this
 * table at all.
 */
export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Reviewing requires the database to be configured." }, { status: 503 });
  }

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const id = clean(body?.id, 64);
  const action = clean(body?.action, 16);
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Pass an id and an action of approve or reject." }, { status: 400 });
  }

  const { data: submission, error: readError } = await auth.client
    .from("place_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  if (action === "reject") {
    const { error } = await auth.client
      .from("place_submissions")
      .update({ status: "rejected", review_note: clean(body?.note, 500) || null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (submission.status === "approved" && submission.published_place_id) {
    return NextResponse.json({ ok: true, placeId: submission.published_place_id });
  }

  const { data: place, error: insertError } = await auth.client
    .from("places")
    .insert({
      name: submission.name,
      area: submission.area,
      address: submission.address,
      known_for: submission.known_for,
      theme: submission.theme,
      maps_url: submission.maps_url,
      media_url: submission.media_url,
      image_url: submission.image_url,
      tags: [],
      lng: submission.lng,
      lat: submission.lat,
      // Provenance, recorded rather than assumed — the same reason the
      // seed script records whether a coordinate came from the sheet as
      // decimal or DMS. A pin somebody dropped on a phone is not the same
      // evidence as one an operator checked.
      coord_source: "public-submission",
      starts_at: submission.starts_at,
      ends_at: submission.ends_at,
      season: CURRENT_SEASON,
      verification_status: "submitted",
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Marked through the service role so a failure here cannot leave an
  // approved submission that looks unreviewed and gets published twice.
  const service = createServiceRoleClient();
  await service
    .from("place_submissions")
    .update({ status: "approved", published_place_id: place.id })
    .eq("id", id);

  return NextResponse.json({ ok: true, placeId: place.id });
}
