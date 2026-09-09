import type { Place } from "@/lib/supabase";

/**
 * The current season. Recurrence is modelled as new rows per year (see
 * supabase/migrations/0002_places.sql), so next year's pandals get
 * "ganesh-2027" and this year's are archived rather than edited in place.
 */
export const CURRENT_SEASON = "ganesh-2026";

/**
 * Ganesh Chaturthi 2026 in Hyderabad: 14 September through immersion on
 * 25 September. Written as explicit IST offsets rather than bare dates —
 * a `new Date("2026-09-14")` is parsed as UTC, which in India is 05:30 on
 * the 14th, so a pandal would read as "not started yet" for the first
 * five and a half hours of its opening day.
 *
 * These are the seed defaults. Per-place overrides live on the row: the
 * admin form edits starts_at/ends_at directly, because immersion dates
 * genuinely differ between pandals in most years even though every
 * pandal in the current sheet immerses on the 25th.
 */
export const SEASON_STARTS_AT = "2026-09-14T00:00:00+05:30";
export const SEASON_ENDS_AT = "2026-09-25T23:59:59+05:30";

/**
 * What the map shows by default: still to come or happening now, and not
 * archived. Deliberately NOT the stricter `now() between starts_at and
 * ends_at` — a festival map whose default view is empty for the fortnight
 * before the festival is worse than useless, and that fortnight is
 * exactly when people are planning. "Live now" is a filter chip
 * (isLiveNow below), not the default.
 *
 * A null ends_at means permanent, and permanent things are always current.
 */
export function isCurrent(place: Place, now: number = Date.now()): boolean {
  if (place.archived_at) return false;
  if (!place.ends_at) return true;
  return new Date(place.ends_at).getTime() >= now;
}

/** Open right now — the coral "live" signal on markers and cards. */
export function isLiveNow(place: Place, now: number = Date.now()): boolean {
  if (place.archived_at) return false;
  const started = !place.starts_at || new Date(place.starts_at).getTime() <= now;
  const ended = place.ends_at ? new Date(place.ends_at).getTime() < now : false;
  return started && !ended;
}

/**
 * Whole days from now until a place's end date, rounded up, or null when
 * it has none. Rounded up rather than truncated so the last day reads
 * "1 day left" instead of "0" while the pandal is still standing.
 */
export function daysUntilEnd(place: Place, now: number = Date.now()): number | null {
  if (!place.ends_at) return null;
  const diff = new Date(place.ends_at).getTime() - now;
  return Math.ceil(diff / 86_400_000);
}

/**
 * The line under a pandal's name: how long is left, or when it opens.
 * Short enough for a marker tooltip and a card header alike.
 */
export function seasonLabel(place: Place, now: number = Date.now()): string | null {
  if (!place.ends_at) return null;
  const end = new Date(place.ends_at);
  const endText = end.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  if (place.starts_at && new Date(place.starts_at).getTime() > now) {
    const opens = new Date(place.starts_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `Opens ${opens}`;
  }

  const days = daysUntilEnd(place, now);
  if (days === null) return null;
  if (days < 0) return `Immersed ${endText}`;
  if (days === 0) return `Immersion today`;
  if (days === 1) return `Immersion tomorrow · ${endText}`;
  return `${days} days left · immersion ${endText}`;
}

/**
 * `<input type="date">` speaks bare YYYY-MM-DD in the *browser's* time
 * zone, while the column is a timestamptz. Converting through the local
 * zone would shift the date for anyone editing from outside India, so
 * both directions below pin to IST explicitly.
 *
 * A start becomes the first moment of that day and an end the last, which
 * is what "the pandal is up on the 25th" actually means — an end stored
 * as midnight would retire it a full day early.
 */
const IST_OFFSET = "+05:30";
const IST_MINUTES = 5 * 60 + 30;

export function toIstDateInput(iso: string | null): string {
  if (!iso) return "";
  const shifted = new Date(new Date(iso).getTime() + IST_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function fromIstDateInput(value: string, edge: "start" | "end"): string | null {
  if (!value) return null;
  return `${value}T${edge === "start" ? "00:00:00" : "23:59:59"}${IST_OFFSET}`;
}
