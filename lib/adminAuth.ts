import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuthedClient, supabase } from "@/lib/supabase";

export type AdminAuthResult =
  | { ok: true; userId: string; client: SupabaseClient }
  | { ok: false; status: number; error: string };

/**
 * Verifies that a request comes from a signed-in user who is in the
 * `admins` table (see 0022_admin_role_and_enquiry_access.sql).
 *
 * Both halves are checked server-side against Postgres: the token is
 * resolved to a real user via Supabase Auth, and admin membership is read
 * through `is_admin()` evaluated *as that user*. Nothing here trusts a
 * client-supplied id or flag.
 *
 * The returned client carries the caller's token, so the RLS policies on
 * whatever it touches evaluate against the same identity that passed this
 * check — the route's authorization and the database's stay in agreement
 * rather than being two separate rules that can drift apart.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminAuthResult> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { ok: false, status: 401, error: "Sign in as an admin to continue." };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Your session has expired — sign in again." };
  }

  const client = createAuthedClient(token);
  const { data: isAdmin, error: rpcError } = await client.rpc("is_admin");
  if (rpcError) return { ok: false, status: 500, error: rpcError.message };
  if (!isAdmin) return { ok: false, status: 403, error: "Admin access is required." };

  return { ok: true, userId: data.user.id, client };
}
