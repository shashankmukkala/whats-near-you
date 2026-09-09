import type { Place } from "@/lib/supabase";

/**
 * Filter and search vocabularies, derived FROM the loaded rows at runtime
 * rather than declared in a hardcoded list.
 *
 * This is a structural fix, not a stylistic preference. The project this
 * one is derived from kept its categories and tags in two hand-written
 * arrays that had to match the data exactly; when the dataset was
 * replaced, zero of eighty-five rows matched the category list and every
 * filter chip silently returned an empty map. Nothing warned, because
 * nothing could — an array in a source file has no way to know what is in
 * the table. Deriving the vocabulary from the data means the two cannot
 * drift apart: a chip exists if and only if a row uses it.
 *
 * The cost is that the vocabulary is only as good as the data, so both
 * helpers below normalise whitespace and drop empties rather than
 * trusting the column.
 */

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Distinct localities, most-populated first then alphabetical, so the
 * filter row leads with the areas that actually have pandals in them.
 */
export function deriveAreas(places: Place[]): string[] {
  const counts = new Map<string, number>();
  for (const place of places) {
    const area = clean(place.area);
    if (area) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([area]) => area);
}

/**
 * Distinct tags across the loaded places. Returns an empty array when no
 * row carries a tag, which is the honest state of the v1 dataset — the
 * research sheet has rich prose but no tag column, and inventing one
 * would be inventing information. Callers render no tag control at all
 * when this is empty rather than an empty dropdown.
 */
export function deriveTags(places: Place[]): string[] {
  const counts = new Map<string, number>();
  for (const place of places) {
    for (const raw of place.tags ?? []) {
      const tag = clean(raw);
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}
