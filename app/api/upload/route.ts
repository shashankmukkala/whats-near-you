import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, isSupabaseConfigured } from "@/lib/supabase";
import { enforceRateLimit, HOUR } from "@/lib/rateLimit";

const BUCKET = "pandal-photos";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Extensions are chosen from the sniffed type, never from the uploaded
 * filename. A filename is attacker-controlled text; letting it decide the
 * stored path is how you end up serving something that is not an image
 * from a bucket everyone can read.
 */
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * The first bytes of each format we accept. Checked instead of trusting
 * the multipart Content-Type header, which the client simply asserts —
 * renaming evil.html to photo.png and claiming image/png is trivial, and
 * the bucket is publicly readable.
 */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const is = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (is(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (is(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // RIFF....WEBP
  if (is(0, [0x52, 0x49, 0x46, 0x46]) && is(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  return null;
}

/**
 * Uploads one photo and returns its public URL.
 *
 * Anonymous by necessity: someone adding a pandal from the street has no
 * account. That makes this the second-most abusable route in the app after
 * /api/submissions, so it is bounded on every axis that matters — attempts
 * per hour, bytes per file, and what the bytes may actually be.
 *
 * The write goes through the service role rather than granting anon any
 * storage permission, so there is no policy that could later be loosened
 * into free file hosting.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "upload", 20, HOUR, "Too many uploads. Try again later.");
  if (limited) return limited;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Uploads require the database to be configured." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is over 5MB — try a smaller one." }, { status: 413 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniff(bytes);
  if (!sniffed || !ALLOWED[sniffed]) {
    return NextResponse.json({ error: "Only PNG, JPEG and WebP photos are accepted." }, { status: 415 });
  }

  // Random name, our extension. Nothing from the client reaches the path.
  const name = `${crypto.randomUUID()}.${ALLOWED[sniffed]}`;
  const service = createServiceRoleClient();
  const { error } = await service.storage.from(BUCKET).upload(name, bytes, {
    contentType: sniffed,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = service.storage.from(BUCKET).getPublicUrl(name);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
