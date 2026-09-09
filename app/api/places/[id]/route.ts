import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";

/**
 * Fields an admin may change from the map. Deliberately an allow-list
 * rather than spreading the request body: a PATCH that forwarded whatever
 * arrived would let a malformed (or crafted) request write `id`,
 * `created_at`, or a coordinate outside the CHECK constraint's intent.
 */
const EDITABLE_FIELDS = [
  "name",
  "area",
  "address",
  "known_for",
  "theme",
  "maps_url",
  "media_url",
  "image_url",
  "tags",
  "lng",
  "lat",
  "starts_at",
  "ends_at",
  "archived_at",
  "season",
  "verification_status",
] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Editing requires the database to be configured." }, { status: 503 });
  }

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await auth.client.from("places").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * Deleting exists for genuine mistakes — a duplicate row, a pin dropped
 * in the wrong city. Retiring a pandal at the end of a season is an
 * ARCHIVE (PATCH archived_at), not a delete: last season's rows are the
 * record of how long a pandal has been running.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Deleting requires the database to be configured." }, { status: 503 });
  }

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { error } = await auth.client.from("places").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
