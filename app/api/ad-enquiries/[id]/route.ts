import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";

// Approving or rejecting an enquiry is the decision that gates whether an
// advertiser's campaign goes live, so it is admin-only and the update runs
// through the caller's own token — the matching RLS policy in 0022 is the
// backstop if this route is ever reached another way.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await request.json().catch(() => ({ status: null }));

  if (!isSupabaseConfigured() || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status or database configuration." }, { status: 400 });
  }

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.client
    .from("ad_enquiries")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
