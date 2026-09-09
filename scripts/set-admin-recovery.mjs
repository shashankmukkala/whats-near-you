// Sets (or replaces) the admin password-recovery code: two secret
// 10-digit numbers, combined into one 20-digit code (first 5 + last 5
// digits of each, in order) and stored as a single salted hash — never
// the raw numbers. To reset a forgotten admin password later, re-enter
// the same first-5/last-5 digits at /admin's "Forgot password?" form,
// which posts to app/api/admin/reset-password and checks them against
// this hash.
//
// The hashing here (scrypt + random salt) must exactly match
// lib/recoveryCode.ts's hashRecoveryCode — this script can't import that
// file directly (it's a standalone Node script, not compiled through
// Next's TS pipeline), so the few lines are duplicated. Change one,
// change both.
//
// Requires the Supabase SERVICE ROLE key — same as scripts/create-admin.mjs.
//
// Usage:
//   node --env-file=.env.local scripts/set-admin-recovery.mjs <adminId> <number1> <number2>
//
// <number1> and <number2> must each be exactly 10 digits, e.g.
// 4829173650. Pick two you'll actually remember (or store safely
// elsewhere) — there is no way to recover them from the database if you
// forget them; you'd need to run this script again with new numbers
// (which itself needs the service role key, so losing both isn't a
// silent lockout, just a "start over with the service role key" one).
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "node:crypto";

const [, , id, number1, number2] = process.argv;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!id || !number1 || !number2) {
  fail("Usage: node --env-file=.env.local scripts/set-admin-recovery.mjs <adminId> <number1> <number2>");
}
if (!/^\d{10}$/.test(number1) || !/^\d{10}$/.test(number2)) {
  fail("Both numbers must be exactly 10 digits each.");
}
if (number1 === number2) {
  fail("Use two different numbers — using the same one twice halves the actual recovery code length.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local and make sure both are set there."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function hashRecoveryCode(code) {
  const salt = randomBytes(16);
  const hash = scryptSync(code, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function findUserById(targetId) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === targetId);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
}

async function main() {
  const user = await findUserById(id);
  if (!user) fail(`No account found for "${id}" — create it first with scripts/create-admin.mjs.`);

  const code = `${number1.slice(0, 5)}${number1.slice(5)}${number2.slice(0, 5)}${number2.slice(5)}`;
  const codeHash = hashRecoveryCode(code);

  const { error } = await supabase
    .from("admin_recovery")
    .upsert({ user_id: user.id, code_hash: codeHash, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) fail(`Failed to save recovery code: ${error.message}`);

  console.log(`Recovery code set for ${id}. To reset the password later, you'll need:`);
  console.log(`  Number 1 — first 5: ${number1.slice(0, 5)}, last 5: ${number1.slice(5)}`);
  console.log(`  Number 2 — first 5: ${number2.slice(0, 5)}, last 5: ${number2.slice(5)}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
