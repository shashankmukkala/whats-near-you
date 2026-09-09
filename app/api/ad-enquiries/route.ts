import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";
import { enforceRateLimit, HOUR } from "@/lib/rateLimit";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  // Anonymous submission is the point of /advertise, so this cannot be
  // gated — which left the admin inbox floodable by a script, with a
  // free-text payment_proof_url in every row. A genuine advertiser sends
  // one enquiry, so five an hour is generous and a flood is not.
  const limited = enforceRateLimit(
    request,
    "ad-enquiry",
    5,
    HOUR,
    "You have sent several enquiries already. Please try again later, or reply to the last one."
  );
  if (limited) return limited;

  const body = await request.json();
  const brand_name = clean(body.brand_name, 120);
  const ad_format = clean(body.ad_format, 30) || "map";
  const contact_name = clean(body.contact_name, 120);
  const contact = clean(body.contact, 160);
  const image_url = clean(body.image_url, 500) || null;
  const target_url = clean(body.target_url, 500) || null;
  const campaign_start = clean(body.campaign_start, 10) || null;
  const campaign_end = clean(body.campaign_end, 10) || null;
  const message = clean(body.message, 1000) || null;
  const payment_proof_url = clean(body.payment_proof_url, 500) || null;

  if (!(["map", "card"] as string[]).includes(ad_format)) {
    return NextResponse.json({ error: "Choose a valid advertising format." }, { status: 400 });
  }

  // contact_name is optional now: the form asks for a business name and a
  // phone, which is what an advertiser actually has to hand. Falling back
  // to the brand keeps the column populated for the admin inbox.
  if (brand_name.length < 2 || contact.length < 5) {
    return NextResponse.json({ error: "A brand name and a contact number are required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Advertising enquiries require the database to be configured." }, { status: 503 });
  }

  const { error } = await supabase.from("ad_enquiries").insert({
    brand_name,
    ad_format,
    contact_name: contact_name || brand_name,
    contact,
    image_url,
    target_url,
    campaign_start,
    campaign_end,
    message,
    payment_proof_url,
    // Recorded at submission rather than read back off the config later,
    // which would misreport anyone who bought before a price change.
    amount_inr: Number.isInteger(body.amount_inr) ? body.amount_inr : null,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// Enquiries carry advertiser contact details and a payment-proof URL, so
// this is admin-only. It reads through the caller's own token rather than
// the anon client: the anon role has no select policy on ad_enquiries at
// all (see 0022), which is why this endpoint previously returned an empty
// list no matter how many enquiries had been submitted.
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json([]);

  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.client
    .from("ad_enquiries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
