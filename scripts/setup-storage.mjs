// Creates the Supabase Storage bucket that pandal photos live in.
//
//   node --env-file=.env.local scripts/setup-storage.mjs
//
// Idempotent: re-running reports the existing bucket rather than failing.
//
// Photos are files in object storage, never base64 data URLs inside the
// row. The project this was derived from stored them inline and returned
// every one of them on every page load — fine at five photos, ruinous at
// eighty-five, and by then the fix means a migration plus a backfill.
//
// The bucket is PUBLIC on read: these are photographs of public festival
// installations, shown on a public map, and a signed URL per pandal per
// page load would be a round trip for no privacy gain. Writes are a
// different matter — nothing writes here directly. Uploads go through
// app/api/upload, which is rate limited and validates type and size with
// the service role. Anon holds no storage write grant at all, so a
// forgotten policy cannot turn the bucket into free file hosting.
import { createClient } from "@supabase/supabase-js";

const BUCKET = "pandal-photos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Missing env. Run with: node --env-file=.env.local scripts/setup-storage.mjs");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await supabase.storage.getBucket(BUCKET);
if (existing) {
  console.log(`\nBucket "${BUCKET}" already exists.`);
  console.log(`  public:          ${existing.public}`);
  console.log(`  size limit:      ${existing.file_size_limit ?? "none"}`);
  console.log(`  allowed types:   ${existing.allowed_mime_types?.join(", ") ?? "any"}\n`);
  process.exit(0);
}

const { error } = await supabase.storage.createBucket(BUCKET, {
  public: true,
  // Enforced by the storage service itself, not just by our route — a
  // limit that only exists in application code is one bad deploy away
  // from not existing.
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
});

if (error) {
  console.error(`Could not create the bucket: ${error.message}`);
  process.exit(1);
}

console.log(`\nCreated bucket "${BUCKET}" — public read, 5MB cap, PNG/JPEG/WebP only.\n`);
