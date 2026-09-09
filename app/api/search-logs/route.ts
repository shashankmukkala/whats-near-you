import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, isSupabaseConfigured } from "@/lib/supabase";
import { enforceRateLimit, MINUTE } from "@/lib/rateLimit";

const MAX_QUERY_LENGTH = 200;

// Fire-and-forget logging from SearchBox.tsx — public, works for
// signed-out visitors too (most searches happen before anyone signs in),
// so this can't go through RLS the way a normal user write would. The
// service role writes on the caller's behalf instead; there's no read
// access for a client at all, only through app/api/admin/analytics.
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true });

  const { query, resultCount } = await request.json().catch(() => ({ query: null, resultCount: null }));
  if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ ok: true });
  }
  // This route takes no authentication by design — an anonymous visitor's
  // search is still the signal worth having — and it writes through the
  // service role, which bypasses RLS. That combination meant one loop could
  // insert unbounded rows into search_logs. 30/minute is well above real
  // typing (the client already debounces to one log per 900ms pause) and
  // far below what a script would want.
  const limited = enforceRateLimit(request, "search-logs", 30, MINUTE, "Too many searches. Try again shortly.");
  if (limited) return limited;

  const safeResultCount = Number.isInteger(resultCount) && resultCount >= 0 ? resultCount : 0;

  // Every search here is anonymous: this product has no public sign-in,
  // so there is no identity to attach and the log is the query alone.
  const service = createServiceRoleClient();
  await service.from("search_logs").insert({ query: query.trim(), result_count: safeResultCount });

  return NextResponse.json({ ok: true });
}
