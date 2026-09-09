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
  const { name, ad_type, slot_number, image_url, target_url, campaign_end, lng, lat, elevation_m, width_m, height_m, heading_deg } = body;

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
      ad_type: ad_type === "aircraft" ? "aircraft" : ad_type === "rail" ? "rail" : "billboard",
      slot_number: ad_type === "rail" && Number.isInteger(slot_number) && slot_number >= 1 && slot_number <= 5 ? slot_number : null,
      image_url: image_url ?? null,
      target_url: target_url ?? null,
      campaign_end: campaign_end || null,
      lng,
      lat,
      elevation_m: elevation_m ?? 0,
      width_m: width_m ?? 10,
      height_m: height_m ?? 5,
      heading_deg: heading_deg ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
