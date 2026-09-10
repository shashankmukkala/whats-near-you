// Deletes photos in storage that nothing references.
//
//   node --env-file=.env.local scripts/prune-uploads.mjs          # dry run
//   node --env-file=.env.local scripts/prune-uploads.mjs --write
//
// Orphans are a designed-in consequence, not a surprise. PhotoUpload sends
// the file the moment it is chosen rather than on submit, because over
// festival-week mobile data a 4MB photo takes real seconds and hiding that
// inside the submit button makes the form feel broken at the exact moment
// someone is deciding whether to bother. The cost of that choice is every
// abandoned form, every removed photo and every replaced one leaving a file
// behind.
//
// The alternative — uploading on submit — trades a slow, silent submit
// button for a tidy bucket, which is the wrong way round. So the files are
// swept up afterwards instead.
//
// GRACE_HOURS exists because "unreferenced" and "not yet referenced" look
// identical from here: someone with the form open has already uploaded a
// photo that no row will mention until they press submit. Deleting those
// would break the form for the people using it right now.
import { createClient } from "@supabase/supabase-js";

const BUCKET = "pandal-photos";
const GRACE_HOURS = 6;
const write = process.argv.includes("--write");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env. Run with: node --env-file=.env.local scripts/prune-uploads.mjs");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

/** Every column anywhere that can hold one of these URLs. */
const REFERENCES = [
  ["places", "image_url"],
  ["place_submissions", "image_url"],
  ["billboards", "image_url"],
  ["ad_enquiries", "image_url"],
  ["ad_enquiries", "payment_proof_url"],
  // Extra ad creatives are stored in the enquiry's message body, so that
  // text counts as a reference too — see AdvertiseForm.
  ["ad_enquiries", "message"],
];

const referenced = new Set();
for (const [table, column] of REFERENCES) {
  const { data, error } = await supabase.from(table).select(column);
  if (error) {
    console.error(`Could not read ${table}.${column}: ${error.message}`);
    process.exit(1);
  }
  for (const row of data ?? []) {
    const value = row[column];
    if (typeof value !== "string") continue;
    // A message can mention several URLs, so scan rather than split once.
    for (const match of value.matchAll(/[0-9a-f-]{36}\.(?:png|jpg|jpeg|webp)/gi)) referenced.add(match[0]);
  }
}

const { data: files, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
if (error) {
  console.error(`Could not list the bucket: ${error.message}`);
  process.exit(1);
}

const cutoff = Date.now() - GRACE_HOURS * 3600_000;
const orphans = [];
let young = 0;
for (const file of files ?? []) {
  if (referenced.has(file.name)) continue;
  const age = new Date(file.created_at ?? 0).getTime();
  if (age > cutoff) {
    young++;
    continue;
  }
  orphans.push(file);
}

const size = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;
console.log(`\n${files?.length ?? 0} file(s) in ${BUCKET}`);
console.log(`  referenced by a row : ${(files?.length ?? 0) - orphans.length - young}`);
console.log(`  unreferenced, under ${GRACE_HOURS}h old (kept — a form may still be open): ${young}`);
console.log(`  orphaned            : ${orphans.length}`);

if (orphans.length === 0) {
  console.log("\nNothing to prune.\n");
  process.exit(0);
}

let freed = 0;
for (const file of orphans) {
  freed += file.metadata?.size ?? 0;
  console.log(`    ${file.name}  ${size(file.metadata?.size ?? 0)}  ${(file.created_at ?? "").slice(0, 16)}`);
}

if (!write) {
  console.log(`\nDRY RUN — would free ${size(freed)}. Re-run with --write.\n`);
  process.exit(0);
}

const { error: removeError } = await supabase.storage.from(BUCKET).remove(orphans.map((f) => f.name));
if (removeError) {
  console.error(`Delete failed: ${removeError.message}`);
  process.exit(1);
}
console.log(`\nRemoved ${orphans.length} file(s), freed ${size(freed)}.\n`);
