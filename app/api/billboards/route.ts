import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  const { data, error } = await supabase
    .from("billboards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, ad_type, slot_number, image_url, target_url, campaign_end, lng, lat } = body;

  if (!name || typeof lng !== "number" || typeof lat !== "number") {
    return NextResponse.json({ error: "name, lng, and lat are required" }, { status: 400 });
  }
  if (ad_type === "rail" && (!Number.isInteger(slot_number) || slot_number < 1 || slot_number > 5)) {
    return NextResponse.json({ error: "Rail ads require a slot number from 1 to 5." }, { status: 400 });
  }

  // Every sponsored format — billboard, aircraft banner, rail slot — is
  // created here. This route being open meant a paid placement could be
  // published for free with a single request, bypassing both the admin
  // console and the enquiry/payment flow entirely.
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.client
    .from("billboards")
    .insert({
      name,
      // Two formats only (migration 0006). Anything unrecognised falls to
      // aircraft rather than being trusted through to the CHECK constraint.
      ad_type: ad_type === "rail" ? "rail" : "aircraft",
      slot_number: ad_type === "rail" && Number.isInteger(slot_number) && slot_number >= 1 && slot_number <= 5 ? slot_number : null,
      image_url: image_url ?? null,
      target_url: target_url ?? null,
      campaign_end: campaign_end || null,
      lng,
      lat,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
