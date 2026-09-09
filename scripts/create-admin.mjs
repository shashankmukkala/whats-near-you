// Creates (or updates the password of) an admin account: a Supabase Auth
// user identified by a plain ID (stored as `email` in auth.users, but
// never actually emailed anything — email_confirm is set true at creation
// so there's no delivery/verification step), with a password set so
// /admin can sign in via lib/useAuth's signInWithPassword. No phone
// number, no SMS/OTP involved. Then grants admin membership by inserting
// into `public.admins` (0022_admin_role_and_enquiry_access.sql), which is
// the table `is_admin()` — and therefore /admin's access check — actually
// reads.
//
// Requires the Supabase SERVICE ROLE key (Dashboard > Settings > API >
// service_role), which can create/update auth users and bypasses the
// `admins` table's RLS (deliberately has no insert policy for anyone
// else — this script is the intended way to grant admin access).
// NEVER put the service role key in NEXT_PUBLIC_* or commit it anywhere;
// pass it via --env-file so it only ever lives in your local .env.local.
//
// Usage:
//   node --env-file=.env.local scripts/create-admin.mjs <id> <password> ["note"]
//
// <id> can be anything shaped like an email (e.g. "owner@whatsnearyou.admin")
// — it's just a unique identifier here, never a real inbox.
//
// (.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// — the latter isn't in .env.local.example since it's more sensitive than
// the anon key; add it yourself before running this.)
import { createClient } from "@supabase/supabase-js";

const [, , id, password, note] = process.argv;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!id || !password) {
  fail('Usage: node --env-file=.env.local scripts/create-admin.mjs <id> <password> ["note"]');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) {
  fail(`ID must be email-shaped (e.g. "owner@whatsnearyou.admin") — got "${id}".`);
}
if (password.length < 8) {
  fail("Password must be at least 8 characters.");
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

async function findUserById(targetId) {
  // admin.listUsers() has no email filter — page through until found.
  // Fine at this app's scale; revisit with a direct query if the user
  // base ever gets large enough for this to matter.
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === targetId);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
}

async function main() {
  let userId;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: id,
    password,
    email_confirm: true,
  });

  if (created?.user) {
    userId = created.user.id;
    console.log(`Created new admin account for ${id}.`);
  } else if (createError && /already/i.test(createError.message)) {
    const existing = await findUserById(id);
    if (!existing) fail(`Supabase says ${id} is already registered, but it couldn't be found by listUsers().`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (updateError) fail(`Failed to update password: ${updateError.message}`);
    userId = existing.id;
    console.log(`${id} already had an account — updated its password.`);
  } else {
    fail(`Failed to create user: ${createError?.message ?? "unknown error"}`);
    return;
  }

  const { error: adminError } = await supabase
    .from("admins")
    .upsert({ user_id: userId, note: note ?? null }, { onConflict: "user_id" });
  if (adminError) fail(`User is set up, but granting admin failed: ${adminError.message}`);

  console.log(`${id} can now sign in at /admin with the password you set.`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
