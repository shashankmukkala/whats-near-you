// Loads scripts/seed-pandals.json into the `places` table.
//
//   node --env-file=.env.local scripts/seed-pandals.mjs          # dry run
//   node --env-file=.env.local scripts/seed-pandals.mjs --write  # actually insert
//
// Generate the JSON first:
//   node scripts/parse-sheet.mjs "Ganesh Pandals - Sheet2.csv"
//
// Uses the SERVICE ROLE key (Dashboard > Settings > API > service_role),
// which bypasses RLS — `places` accepts writes only from an admin session
// (migration 0002), and a seed script has no session. NEVER put that key
// in a NEXT_PUBLIC_* variable or commit it; --env-file keeps it in
// .env.local only.
//
// Idempotent by (name, season): re-running updates the matching row
// instead of creating a second copy. This matters more than it looks — a
// seed script that duplicates on re-run is how a map ends up with two
// pins on top of each other and no way to tell which one is current.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(HERE, "seed-pandals.json");
const write = process.argv.includes("--write");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/seed-pandals.mjs --write"
  );
}
if (!fs.existsSync(SEED_FILE)) {
  fail(`No ${path.relative(process.cwd(), SEED_FILE)} — run scripts/parse-sheet.mjs first.`);
}

const rows = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) fail("Seed file is empty.");

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\n${write ? "Seeding" : "DRY RUN —"} ${rows.length} pandals into ${url}\n`);

if (!write) {
  for (const row of rows) {
    console.log(`  ${row.name}`);
    console.log(`      ${row.area ?? "(no area)"} · ${row.lat}, ${row.lng} · ${row.coord_source}`);
    console.log(`      ${row.starts_at.slice(0, 10)} → ${row.ends_at.slice(0, 10)} · ${row.season}`);
  }
  console.log("\nNothing was written. Re-run with --write to insert.\n");
  process.exit(0);
}

const { data: existing, error: readError } = await supabase
  .from("places")
  .select("id,name,season")
  .eq("season", rows[0].season);

if (readError) fail(`Could not read existing places: ${readError.message}`);

const byName = new Map((existing ?? []).map((r) => [r.name, r.id]));
let inserted = 0;
let updated = 0;

for (const row of rows) {
  const id = byName.get(row.name);
  if (id) {
    const { error } = await supabase.from("places").update(row).eq("id", id);
    if (error) fail(`Update failed for "${row.name}": ${error.message}`);
    updated++;
  } else {
    const { error } = await supabase.from("places").insert(row);
    if (error) fail(`Insert failed for "${row.name}": ${error.message}`);
    inserted++;
  }
}

console.log(`  inserted ${inserted}`);
console.log(`  updated  ${updated}`);
console.log("\nDone. Open / to see them on the map.\n");
