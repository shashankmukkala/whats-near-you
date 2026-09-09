import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Lazily initialized so builds/pages that don't touch Supabase still work
// before NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.local.example to .env.local and fill in your Supabase project's values."
    );
  }

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});

let adminClient: SupabaseClient | null = null;

// A second, fully separate Supabase Auth session from the public
// `supabase` client above — same project, different `storageKey`, so the
// browser keeps two independent sessions side by side instead of one
// shared one. Without this, signing into /admin (email+password) and
// browsing the public map (Google) fought over the same localStorage
// session: whichever signed in most recently "won", the admin operator's
// account started showing up as a signed-in visitor on the public site,
// and signing out of either logged both out. Used only by
// lib/useAdminAuth.ts and the admin-only routes/components that read its
// token — every visitor-facing hook (useAuth, useVisitTracking,
// usePoints, ...) keeps using the plain `supabase` client above.
function getAdminSupabase(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.local.example to .env.local and fill in your Supabase project's values."
    );
  }

  adminClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { storageKey: "whatsnearyou-admin-auth" },
  });
  return adminClient;
}

export const adminSupabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getAdminSupabase(), prop, receiver);
  },
});

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

// A request-scoped client that forwards the signed-in user's access token,
// so Postgres RLS policies that check auth.uid() (e.g. "users write their
// own reviews") evaluate against that real user — not an anonymous
// service-level connection. Used server-side in API routes; never cached,
// since it's specific to one request's caller.
export function createAuthedClient(accessToken: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Bypasses RLS entirely — the service role is a full-trust connection,
// same as the Postgres superuser as far as PostgREST is concerned. Only
// ever call this from server-side code that has already independently
// verified what it's about to do (e.g. app/api/admin/reset-password,
// which checks a hashed recovery code before touching anything). Safe to
// export from this shared module despite that: SUPABASE_SERVICE_ROLE_KEY
// is a server-only env var (no NEXT_PUBLIC_ prefix), so Next.js never
// bundles it into client-side JS regardless of what imports this file.
export function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Billboard = {
  id: string;
  name: string;
  /**
    * Where the ad is seen, which is also how it is priced (see
    * lib/adPlacements.ts). The 3D billboard went in 0006 and the aircraft
    * banner in 0008 — the latter had no natural inventory limit, so there
    * was no scarcity to sell, and it competed with the pins for the one
    * thing the map is for.
    */
  ad_type: "map" | "card";
  slot_number: number | null;
  image_url: string | null;
  target_url: string | null;
  /** ISO date, e.g. "2026-09-25" — when this placement's campaign ends.
   *  A festival sponsorship should expire with the festival, so the map
   *  drops a placement once this date has passed (see lib/adFilter.ts).
   *  Null means "no end date on file", which renders indefinitely. */
  campaign_end: string | null;
  /** Where an aircraft banner enters the map. Unused by a rail slot. */
  lng: number;
  lat: number;
  advertiser_id: string | null;
  created_at: string;
};

/**
 * A pinned, time-bound happening — in v1, a Ganesh pandal.
 *
 * The shape mirrors the public column grants in
 * supabase/migrations/0002_places.sql. `verification_status` and
 * `coord_source` are deliberately absent: they are internal research
 * fields, kept out of every public payload by both the column grants and
 * app/api/places' explicit select list. The admin console reads them
 * through AdminPlace below instead.
 */
export type Place = {
  id: string;
  name: string;
  /** Neighbourhood/locality, e.g. "Ram Nagar, Secunderabad". */
  area: string | null;
  address: string | null;
  /** The one piece of editorial writing on the card — why this pandal matters. */
  known_for: string | null;
  /** This season's concept/decoration, which genuinely changes year to year. */
  theme: string | null;
  /** Google's own Maps link, preferred over building directions from lng/lat. */
  maps_url: string | null;
  /** Instagram / Facebook / reel link. Linked out to, never embedded. */
  media_url: string | null;
  image_url: string | null;
  tags: string[];
  lng: number;
  lat: number;
  /** ISO timestamp. Null means permanent. */
  starts_at: string | null;
  /** ISO timestamp — immersion, end of day IST. Null means permanent. */
  ends_at: string | null;
  /** Set once a season is over. Archived places are kept, never deleted. */
  archived_at: string | null;
  /** e.g. "ganesh-2026". Recurrence is modelled as new rows per season. */
  season: string | null;
  created_at: string;
};

/**
 * What the admin console sees: everything above plus the internal
 * research fields. Only ever returned by admin-authenticated routes.
 */
export type AdminPlace = Place & {
  /**
   * Internal only — whether the operator has personally verified this
   * record. Never render this on a public surface.
   */
  verification_status: string | null;
  /** 'sheet-decimal' | 'sheet-dms' | 'admin-pin' — coordinate provenance. */
  coord_source: string | null;
};

/**
 * A city news item — festival announcements, procession timings, road
 * closures. Not map-pinned: anything that belongs at a coordinate is a
 * Place instead. Feeds LiveTicker and EventsPanel.
 */
export type CityEvent = {
  id: string;
  name: string;
  /** ISO date, e.g. "2026-09-25". */
  event_date: string;
  location: string | null;
  description: string | null;
  created_at: string;
};
