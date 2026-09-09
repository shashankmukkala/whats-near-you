import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";

// Admin-only, same reasoning as the create route: this was open, and so
// was the table's RLS (0003), so anyone could delete any event on the
// public ticker with one request.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Deleting news requires the database to be configured." }, { status: 503 });
  }

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error } = await auth.client.from("events").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
