import { NextResponse, type NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Without this the map grows one entry per distinct caller forever, so the
// limiter would itself become the memory leak it exists to prevent. Swept
// opportunistically on write rather than on a timer, which would keep a
// serverless instance alive.
const SWEEP_EVERY = 500;
let writesSinceSweep = 0;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Fixed-window counter, keyed by whatever the caller passes.
 *
 * In-memory on purpose: this project has no Redis, and adding one for a
 * few hundred requests a day would be the wrong trade. The consequence is
 * that on a multi-instance serverless deploy each instance keeps its own
 * counter, so the effective limit is the configured one times the number
 * of warm instances. That is a real weakness and it is still far better
 * than the previous state, which was no limit at all on endpoints that
 * write unbounded rows. If traffic ever justifies exactness, swap the Map
 * for Upstash Redis behind this same function signature — no call site
 * needs to change.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (++writesSinceSweep >= SWEEP_EVERY) {
    writesSinceSweep = 0;
    sweep(now);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { ok: true };
}

/**
 * Best-effort caller identity for limiting.
 *
 * x-forwarded-for is set by the platform's proxy; the leftmost entry is
 * the original client. It is spoofable in principle, but on Vercel the
 * proxy rewrites it, and an attacker who can rotate it can also rotate
 * source IPs — so this is the practical ceiling for IP-based limiting
 * rather than a gap worth solving here. Falls back to a single shared
 * bucket, which fails closed (everyone shares one limit) rather than open.
 */
export function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** 429 with the header clients and crawlers actually respect. */
export function tooManyRequests(retryAfterSeconds: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/**
 * Convenience wrapper: limit by caller, return the 429 response if over.
 * Returns null when the request should proceed.
 */
export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number,
  message: string
): NextResponse | null {
  const result = rateLimit(`${scope}:${clientKey(request)}`, limit, windowMs);
  if (result.ok) return null;
  return tooManyRequests(result.retryAfterSeconds, message);
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
