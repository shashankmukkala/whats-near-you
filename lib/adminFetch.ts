import { adminSupabase } from "@/lib/supabase";

/**
 * fetch() that attaches the admin console's bearer token.
 *
 * The admin console runs on its own Supabase session, separate from the
 * public site's (see lib/useAdminAuth.ts and adminSupabase), so a plain
 * fetch from an /admin form sends no credentials at all — which was fine
 * while the create routes were ungated, and stops working the moment they
 * require an admin (see requireAdmin in lib/adminAuth.ts).
 *
 * Reads the session at call time rather than taking a token as a prop:
 * the token can be refreshed between a page loading and a form being
 * submitted, and a value captured at render time would be the stale one.
 * It also keeps the placement forms from each having to thread a token
 * down from MapExperience.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await adminSupabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
