import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";

/**
 * Exactly what the public may see.
 *
 * `verification_status` and `coord_source` are internal research fields
 * and are absent on purpose. This list is the second of two mechanisms
 * keeping them that way — the first is the column-level grant in
 * supabase/migrations/0002_places.sql, which stops the anon role reading
 * them at all. Two mechanisms because RLS is row-level and cannot hide a
 * column, so a future `select("*")` written here without thinking would
 * otherwise be the whole defence.
 */
const PUBLIC_COLUMNS =
  "id,name,area,address,known_for,theme,maps_url,media_url,image_url,tags,lng,lat,starts_at,ends_at,archived_at,season,created_at";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json([]);

  // An admin reading the same endpoint gets the internal fields and the
  // archived rows too, through their own token so RLS evaluates as them.
  // Anonymous callers never reach that branch.
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const auth = await requireAdmin(request);
    if (auth.ok) {
      const { data, error } = await auth.client.from("places").select("*").order("name");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
  }

  // Archived rows are last season's — kept in the table, excluded from
  // the map. The "still to come or on now" cut happens client-side (see
  // lib/season.ts): it is a filter people toggle, and at this dataset
  // size shipping every current row costs nothing.
  const { data, error } = await supabase
    .from("places")
    .select(PUBLIC_COLUMNS)
    .is("archived_at", null)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Pinning a pandal requires the database to be configured." }, { status: 503 });
  }

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body?.name || typeof body.lng !== "number" || typeof body.lat !== "number") {
    return NextResponse.json({ error: "name, lng and lat are required." }, { status: 400 });
  }

  const { data, error } = await auth.client
    .from("places")
    .insert({
      name: String(body.name).trim(),
      area: body.area ?? null,
      address: body.address ?? null,
      known_for: body.known_for ?? null,
      theme: body.theme ?? null,
      maps_url: body.maps_url ?? null,
      media_url: body.media_url ?? null,
      image_url: body.image_url ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      lng: body.lng,
      lat: body.lat,
      coord_source: body.coord_source ?? "admin-pin",
      starts_at: body.starts_at ?? null,
      ends_at: body.ends_at ?? null,
      season: body.season ?? null,
      verification_status: body.verification_status ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
