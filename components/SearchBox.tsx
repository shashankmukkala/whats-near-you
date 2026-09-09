"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/supabase";
import { foldAccents, matchSearchGroup, type SearchGroupMatch } from "@/lib/searchMatch";

export type { SearchGroupMatch };

type SearchBoxProps = {
  places: Place[];
  /** Tag vocabulary derived from the loaded rows — see lib/vocabulary.ts. */
  tagVocabulary: string[];
  onSelectPlace: (place: Place) => void;
  /** Fired (debounced) whenever the typed text matches an area, a tag or
   *  a live-now intent — as opposed to one pandal by name — so the caller
   *  can show every match at once and fit the map to them. Fired with
   *  null when there is no such match, including an empty query. */
  onGroupMatch: (match: SearchGroupMatch) => void;
  /** Bump this to clear the query text from outside — e.g. when the
   *  parent closes the results panel via its own X, so a stale query
   *  cannot silently re-match and reopen the panel a moment later. */
  clearSignal?: number;
  /** Bump this to close just the name dropdown, leaving the query and the
   *  results panel alone. Fired when a pandal is picked from outside this
   *  component (a results row, a map pin), which would otherwise leave
   *  the dropdown sitting open under the search bar with no way to
   *  dismiss it. */
  dismissDropdownSignal?: number;
};

/**
 * Free-text search over the loaded pandals.
 *
 * Unlike the project this is adapted from, there is no geocoded-address
 * dropdown here. That fed a Nominatim proxy which resolved 1 of 48 Indian
 * plot-number addresses, and its suggestions were the source of a whole
 * class of bugs — Enter jumping the map to an unrelated street with a
 * similar name, an irrelevant address list sitting open over the map next
 * to real results. For fifteen curated pandals it was never earning its
 * place, so the box searches the actual dataset and nothing else.
 */
export default function SearchBox({
  places,
  tagVocabulary,
  onSelectPlace,
  onGroupMatch,
  clearSignal,
  dismissDropdownSignal,
}: SearchBoxProps) {
  const [query, setQuery] = useState("");
  // True while the text in the box was put there by choosing one pandal
  // rather than typed — see selectPlace and the group-match effect.
  const [queryFromPick, setQueryFromPick] = useState(false);
  const [dropdownHidden, setDropdownHidden] = useState(false);
  const groupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset in response to an incoming signal, adjusted during render
  // (React's documented pattern for state driven by a prop) rather than
  // in an effect, which would apply it a frame late.
  const [lastClearSignal, setLastClearSignal] = useState(clearSignal);
  if (clearSignal !== undefined && clearSignal !== lastClearSignal) {
    setLastClearSignal(clearSignal);
    setQuery("");
    setQueryFromPick(false);
    setDropdownHidden(false);
  }

  const [lastDismissSignal, setLastDismissSignal] = useState(dismissDropdownSignal);
  if (dismissDropdownSignal !== undefined && dismissDropdownSignal !== lastDismissSignal) {
    setLastDismissSignal(dismissDropdownSignal);
    setDropdownHidden(true);
  }

  // Accent-folded on both sides, so a name typed on an English keyboard
  // finds the pandal as spelled in the data.
  const foldedQuery = foldAccents(query.trim()).toLowerCase();
  const matchingPlaces =
    foldedQuery.length >= 2
      ? places
          .filter(
            (p) =>
              foldAccents(p.name).toLowerCase().includes(foldedQuery) ||
              (p.area ? foldAccents(p.area).toLowerCase().includes(foldedQuery) : false)
          )
          .slice(0, 5)
      : [];

  // An area/tag/live query has no single right pandal to jump to — it
  // matches many at once — so it is reported up via onGroupMatch instead
  // of rendered as dropdown rows, and typing "ram nagar" or "live" is
  // enough to see results without picking anything.
  //
  // `places` here is already the chip-filtered list, so search composes
  // with the manual filters instead of overriding them. That makes it a
  // real dependency: when a chip changes, this must re-run against the
  // narrower set with the same query text, or the panel keeps showing
  // matches computed against the old filter state.
  useEffect(() => {
    if (groupDebounceRef.current) clearTimeout(groupDebounceRef.current);
    const q = query.trim();

    // Written by picking a pandal, not typed — treat it as "go to that
    // one place" and leave the filters and the camera alone. Typing
    // clears the flag, so editing after a pick resumes group matching.
    if (queryFromPick) return;

    if (q.length < 2) {
      onGroupMatch(null);
      return;
    }

    groupDebounceRef.current = setTimeout(() => {
      onGroupMatch(matchSearchGroup(q, places, tagVocabulary));
    }, 350);
    // onGroupMatch is a fresh identity every render (not memoized in the
    // parent), so including it would defeat the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, queryFromPick, places, tagVocabulary]);

  // Logged on a longer debounce than the match above (900ms vs 350ms) so
  // a search is recorded once someone actually pauses on it, not once per
  // keystroke on the way to a longer word. Fire-and-forget: analytics
  // must never be able to affect the search UI, so there is no loading or
  // error state and a failure is dropped silently.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      const group = matchSearchGroup(q, places, tagVocabulary);
      const nameMatches = places.filter((p) =>
        foldAccents(p.name).toLowerCase().includes(foldAccents(q).toLowerCase())
      ).length;
      fetch("/api/search-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, resultCount: group ? group.places.length : nameMatches }),
      }).catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [query, places, tagVocabulary]);

  function search(value: string) {
    // Typing always resumes normal group searching, whatever put the
    // previous text there.
    setQueryFromPick(false);
    setDropdownHidden(false);
    setQuery(value);
  }

  function selectPlace(place: Place) {
    // Marks the text below as written by a pick rather than typed.
    // Picking one pandal writes its name into the box, which then looks
    // exactly like a fresh group query to the debounced effect above —
    // and most names here contain a word the matcher knows ("Ramnagar Ka
    // Raja" contains its own area). Without this flag, tapping a result
    // flew the map to that pandal and then, 350ms later, refitted across
    // every pandal in its area.
    setQueryFromPick(true);
    setDropdownHidden(true);
    onSelectPlace(place);
    setQuery(place.name);
  }

  // Computed on every render rather than read from the debounced state in
  // the parent, so Enter and the dropdown always reflect the current
  // query — including the instant it is typed. matchSearchGroup is a
  // cheap pure function.
  const trimmedQuery = query.trim();
  const groupMatch = trimmedQuery.length >= 2 ? matchSearchGroup(trimmedQuery, places, tagVocabulary) : null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Acts on the top row exactly as clicking it would. With no matching
    // name, an area/tag query is already showing its own results panel
    // below, so Enter has nothing more to do.
    if (matchingPlaces[0]) selectPlace(matchingPlaces[0]);
  }

  const showDropdown = !dropdownHidden && trimmedQuery.length >= 2 && (matchingPlaces.length > 0 || !groupMatch);

  return (
    <div className="relative w-full">
      <svg
        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="9" cy="9" r="6" />
        <path d="M17 17l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={query}
        onChange={(e) => search(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search pandals, areas, what's live…"
        className="search-input w-full rounded-full py-2.5 pr-4 pl-9 text-sm focus:outline-none"
      />
      {showDropdown && (
        <div className="panel-elevated absolute top-full z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl">
          {matchingPlaces.map((place) => (
            <button
              key={place.id}
              onClick={() => selectPlace(place)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--accent-tint)]"
            >
              <span aria-hidden="true">📍</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{place.name}</span>
                {place.area && <span className="text-[var(--ink-muted)]"> · {place.area}</span>}
              </span>
            </button>
          ))}
          {matchingPlaces.length === 0 && !groupMatch && (
            <div className="px-4 py-2 text-sm text-[var(--ink-muted)]">No pandals match that yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
