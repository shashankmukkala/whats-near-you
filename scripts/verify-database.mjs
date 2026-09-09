// Verifies the live database against what the app expects — schema, then
// row-level security probed from OUTSIDE with the anon key.
//
//   node --env-file=.env.local scripts/verify-database.mjs
//
// Why this exists rather than trusting supabase/migrations/: in the
// project this one is derived from, a migration sat unapplied against the
// live database for months. The symptom was invisible until probed — a
// column the code wrote to did not exist, so writes failed AND the table
// was still world-writable. Migration files describe intent. This checks
// what is actually there.
//
// The anon key is the honest attacker's position: it ships in every
// browser that loads the site. What it can do here is what anyone can do.
//
// PostgREST error codes worth knowing:
//   42501         the policy refused it                        GOOD
//   23502 / 23514 it reached a column/CHECK constraint, meaning
//                 RLS let it through                           BAD — a hole
//   42703         the column is not readable by this role       (used for
//                 the internal-field check, where it is GOOD)
//
// One caveat this script is honest about: an empty table returns [] to a
// SELECT whether RLS refused it or the table simply has no rows, so a
// passing read probe on an empty table proves nothing. Row counts are
// printed next to each read result so you can tell the two apart.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing env. Run with: node --env-file=.env.local scripts/verify-database.mjs");
  process.exit(1);
}

const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

let failures = 0;
const pass = (label, detail = "") => console.log(`  PASS  ${label}${detail ? `  — ${detail}` : ""}`);
const fail = (label, detail = "") => {
  failures++;
  console.log(`  FAIL  ${label}${detail ? `  — ${detail}` : ""}`);
};

console.log(`\nVerifying ${url}\n`);
console.log("Schema (service role — bypasses RLS, so this only asks 'does it exist')");

const TABLES = ["admins", "admin_recovery", "places", "events", "billboards", "ad_enquiries", "search_logs"];
const counts = {};
for (const table of TABLES) {
  const { error, count } = await svc.from(table).select("*", { count: "exact", head: true });
  counts[table] = count ?? 0;
  if (error) fail(`table ${table}`, error.message);
  else pass(`table ${table}`, `${count} row${count === 1 ? "" : "s"}`);
}

// Every column the product reads or writes. A missing one fails loudly
// here instead of silently at request time.
const { error: columnsError } = await svc
  .from("places")
  .select(
    "id,name,area,address,known_for,theme,maps_url,media_url,image_url,tags,lng,lat,coord_source,starts_at,ends_at,archived_at,season,verification_status,created_at"
  )
  .limit(1);
if (columnsError) fail("places has every expected column", columnsError.message);
else pass("places has every expected column");

const { error: isAdminError } = await svc.rpc("is_admin");
if (isAdminError) fail("is_admin() exists", isAdminError.message);
else pass("is_admin() exists");

// A delete probe against an empty table proves nothing, and the events
// table is legitimately empty most of the time — so the probe plants a row
// of its own through the service role rather than reporting an untested
// policy as fine, and removes it again at the end. Nothing here depends on
// the operator having posted real content first.
const PROBE_EVENT = "RLS PROBE — safe to delete";
await svc.from("events").delete().eq("name", PROBE_EVENT);
const { error: plantError } = await svc.from("events").insert({ name: PROBE_EVENT, event_date: "2026-09-20" });
if (plantError) fail("could not plant a probe row in events", plantError.message);
else counts.events += 1;

console.log("\nRow-level security (anon key — this is what any visitor can do)");

// --- Public reads that SHOULD work: the map is the product. -------------
for (const table of ["places", "events", "billboards"]) {
  const { data, error } = await anon.from(table).select("id").limit(5);
  if (error) fail(`anon can read ${table}`, error.message);
  else pass(`anon can read ${table}`, `${data.length} of ${counts[table]} row(s) visible`);
}

// --- The internal research field must be unreachable. -------------------
// RLS is row-level and cannot hide a column; this is enforced by the
// column-level grants in migration 0002, so it is worth checking
// separately from every other policy.
{
  const { error } = await anon.from("places").select("verification_status").limit(1);
  if (error) pass("anon CANNOT read places.verification_status", `${error.code ?? "?"} ${error.message}`);
  else fail("anon CANNOT read places.verification_status", "the internal field is publicly readable");
}
{
  const { error } = await anon.from("places").select("coord_source").limit(1);
  if (error) pass("anon CANNOT read places.coord_source", `${error.code ?? "?"}`);
  else fail("anon CANNOT read places.coord_source", "internal field is publicly readable");
}

// --- UPDATE and DELETE: assert on EFFECT, not on the error code. --------
//
// This is the part that is easy to get wrong, and getting it wrong reports
// a correct policy as a hole (or, worse, the reverse).
//
// An INSERT that fails WITH CHECK raises 42501. An UPDATE or DELETE does
// not: the USING clause acts as a row FILTER, so a policy that excludes
// every row leaves the statement matching nothing — and a statement that
// matches nothing SUCCEEDS. "No error" is therefore the expected result of
// a perfectly good policy, and asserting on the error alone would flag
// every correctly-locked table.
//
// So these run the write and then re-read through the service role to ask
// the only question that matters: did anything actually change.
async function assertNoEffect(label, table, fingerprint, write) {
  if (counts[table] === 0) {
    console.log(`  ????  ${label}  — ${table} is empty, so nothing was there to change — proves nothing`);
    return;
  }
  const before = await fingerprint();
  await write();
  const after = await fingerprint();
  if (before === after) pass(label, `data unchanged (${before})`);
  else fail(label, `DATA CHANGED: ${before} -> ${after} — this is a hole`);
}

const placesFingerprint = async () => {
  const { data, count } = await svc.from("places").select("name", { count: "exact" }).order("name");
  return `${count} rows, ${(data ?? []).map((r) => r.name).join("|").length} name-chars`;
};
const eventsFingerprint = async () => {
  const { count } = await svc.from("events").select("*", { count: "exact", head: true });
  return `${count} rows`;
};

await assertNoEffect("anon CANNOT update a place", "places", placesFingerprint, () =>
  anon.from("places").update({ name: "RLS PROBE" }).neq("id", "00000000-0000-0000-0000-000000000000")
);
await assertNoEffect("anon CANNOT delete a place", "places", placesFingerprint, () =>
  anon.from("places").delete().neq("id", "00000000-0000-0000-0000-000000000000")
);
await assertNoEffect("anon CANNOT delete news", "events", eventsFingerprint, () =>
  anon.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000")
);

// --- INSERTs that must be refused. These DO raise, so the code is the ----
// --- assertion: 42501 is the policy refusing; 23502/23514 would mean ----
// --- it reached a constraint, i.e. RLS had already let it through. ------
const writeProbes = [
  {
    label: "anon CANNOT insert a place",
    run: () =>
      anon.from("places").insert({ name: "RLS PROBE — delete me", lng: 78.49, lat: 17.43 }),
  },
  {
    label: "anon CANNOT post news",
    run: () => anon.from("events").insert({ name: "RLS PROBE", event_date: "2026-09-20" }),
  },
  {
    label: "anon CANNOT publish a billboard",
    run: () => anon.from("billboards").insert({ name: "RLS PROBE", lng: 78.49, lat: 17.43, ad_type: "rail", slot_number: 1 }),
  },
  {
    label: "anon CANNOT read ad enquiries (contact details, payment proof)",
    run: async () => {
      const { data, error } = await anon.from("ad_enquiries").select("brand_name,contact");
      // A read is refused by returning no rows, not an error — so this is
      // only meaningful when the table actually has rows to hide.
      if (error) return { error };
      if (data.length > 0) return { error: null };
      return { error: { code: "0 rows", message: counts.ad_enquiries > 0 ? "hidden" : "table is empty — proves nothing" } };
    },
  },
  {
    label: "anon CANNOT self-approve an ad enquiry",
    run: () =>
      anon.from("ad_enquiries").insert({
        brand_name: "RLS PROBE",
        contact_name: "RLS PROBE",
        contact: "probe@example.com",
        status: "approved",
      }),
  },
  {
    label: "anon CANNOT write search logs directly",
    run: () => anon.from("search_logs").insert({ query: "RLS PROBE", result_count: 0 }),
  },
  {
    label: "anon CANNOT read the admin list",
    run: async () => {
      const { data, error } = await anon.from("admins").select("user_id");
      if (error) return { error };
      if (data.length > 0) return { error: null };
      return { error: { code: "0 rows", message: counts.admins > 0 ? "hidden" : "table is empty — proves nothing" } };
    },
  },
  {
    label: "anon CANNOT read admin recovery hashes",
    run: async () => {
      const { data, error } = await anon.from("admin_recovery").select("code_hash");
      if (error) return { error };
      if (data.length > 0) return { error: null };
      return { error: { code: "0 rows", message: counts.admin_recovery > 0 ? "hidden" : "table is empty — proves nothing" } };
    },
  },
];

for (const probe of writeProbes) {
  // An UPDATE or DELETE matching zero rows succeeds with no error even
  // when the policy would have refused it — there is nothing there to
  // refuse. Running it against an empty table therefore proves exactly as
  // little as a SELECT against one, and reporting it as a pass would be
  // worse than useless: it is a green tick on an untested policy.
  if (probe.needsRowsIn && counts[probe.needsRowsIn] === 0) {
    console.log(`  ????  ${probe.label}  — ${probe.needsRowsIn} is empty, so nothing was there to refuse — proves nothing`);
    continue;
  }
  const { error } = await probe.run();
  if (!error) {
    fail(probe.label, "IT WENT THROUGH — this is a hole");
    continue;
  }
  const code = error.code ?? "";
  if (code === "23502" || code === "23514") {
    fail(probe.label, `${code} — reached a constraint, so RLS let it through`);
  } else if (String(error.message).includes("proves nothing")) {
    console.log(`  ????  ${probe.label}  — ${error.message}`);
  } else {
    pass(probe.label, `${code} ${error.message}`.trim());
  }
}

// --- The one write anon SHOULD be able to make. -------------------------
// Submitting an enquiry is the entire point of /advertise. Cleaned up
// with the service role afterwards so the probe leaves nothing behind.
{
  const { data, error } = await svc
    .from("ad_enquiries")
    .select("id")
    .eq("brand_name", "RLS PROBE (submittable)")
    .limit(1);
  if (data?.length) await svc.from("ad_enquiries").delete().eq("id", data[0].id);
  if (error) {
    /* ignore — cleanup is best-effort */
  }
}
{
  const { error } = await anon.from("ad_enquiries").insert({
    brand_name: "RLS PROBE (submittable)",
    contact_name: "RLS PROBE",
    contact: "probe@example.com",
    status: "pending",
  });
  if (error) fail("anon CAN submit a pending ad enquiry (/advertise must work)", error.message);
  else pass("anon CAN submit a pending ad enquiry");
  await svc.from("ad_enquiries").delete().eq("brand_name", "RLS PROBE (submittable)");
}

// Remove the planted row. Done before the summary so a failure here is
// visible rather than buried under the result line.
{
  const { error } = await svc.from("events").delete().eq("name", PROBE_EVENT);
  if (error) fail("could not clean up the probe row in events", error.message);
  else pass("probe row removed from events");
}

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check${failures === 1 ? "" : "s"} FAILED — see above.\n`
);
process.exit(failures === 0 ? 0 : 1);
