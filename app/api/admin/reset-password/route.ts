import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";
import { verifyRecoveryCode } from "@/lib/recoveryCode";
import { enforceRateLimit, MINUTE } from "@/lib/rateLimit";

const DIGITS5 = /^\d{5}$/;

// Self-service password reset for the admin login — no email/SMS
// delivery involved, since neither is reliably available for this app
// (see the Send SMS hook notes). Instead, an admin who set up a recovery
// code (scripts/set-admin-recovery.mjs) proves they know it by re-typing
// the same four 5-digit pieces, which get checked against a stored hash
// (lib/recoveryCode.ts) — never against the raw code, which isn't stored
// anywhere. Deliberately returns the same generic error whether the ID
// doesn't exist, has no recovery code set, or the code is wrong, so this
// endpoint can't be used to enumerate which IDs are registered.
export async function POST(request: NextRequest) {
  // Unauthenticated by necessity — you cannot sign in to reset the
  // password you have lost. The 20-digit recovery code makes guessing
  // hopeless, so the exposure here is not the credential: every attempt
  // runs scrypt, which is deliberately expensive, so an unlimited endpoint
  // is a CPU exhaustion lever. Five tries per 15 minutes is far more than
  // a real admin needs and removes that lever.
  const limited = enforceRateLimit(
    request,
    "admin-reset",
    5,
    15 * MINUTE,
    "Too many attempts. Wait a few minutes and try again."
  );
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { id, num1First5, num1Last5, num2First5, num2Last5, newPassword } = body as Record<string, unknown>;

  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "Enter your admin ID." }, { status: 400 });
  }
  for (const [name, value] of [
    ["num1First5", num1First5],
    ["num1Last5", num1Last5],
    ["num2First5", num2First5],
    ["num2Last5", num2Last5],
  ] as const) {
    if (typeof value !== "string" || !DIGITS5.test(value)) {
      return NextResponse.json({ error: `${name} must be exactly 5 digits.` }, { status: 400 });
    }
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const code = `${num1First5}${num1Last5}${num2First5}${num2Last5}`;
  const GENERIC_ERROR = "That ID or recovery code isn't right.";

  const supabase = createServiceRoleClient();

  // No admin.getUserByEmail() in supabase-js — page through listUsers()
  // like scripts/create-admin.mjs and scripts/set-admin-recovery.mjs do.
  let userId: string | null = null;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const found = data.users.find((u) => u.email === id.trim());
    if (found) {
      userId = found.id;
      break;
    }
    if (data.users.length < 200) break;
  }
  if (!userId) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });

  const { data: recovery, error: recoveryError } = await supabase
    .from("admin_recovery")
    .select("code_hash")
    .eq("user_id", userId)
    .maybeSingle();
  if (recoveryError) return NextResponse.json({ error: recoveryError.message }, { status: 500 });
  if (!recovery || !verifyRecoveryCode(code, recovery.code_hash)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
