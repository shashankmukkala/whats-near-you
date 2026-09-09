"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/supabase";
import { isLiveNow, seasonLabel } from "@/lib/season";

/** Default when nothing else is competing for space; MapExperience passes
 *  a smaller `pageSize` once the right column can't fit that much — see
 *  the shrink-to-fit effect there. */
const DEFAULT_PAGE_SIZE = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

type SearchResultsPanelProps = {
  /** e.g. "● Live now · 📍 Ram Nagar". */
  label: string;
  places: Place[];
  onSelect: (place: Place) => void;
  onClose: () => void;
  /** Rows per carousel page. Defaults to 5; MapExperience shrinks this
   *  when DetailCard/a sidebar tab is also on screen and 5 would overflow
   *  the column and force a scrollbar. */
  pageSize?: number;
};

// Shown when a search query matches an area, a tag, or a "what's live
// now" intent — not one pandal by name — so instead of a dropdown pick it
// surfaces every match at once (the map also zooms to fit them, see
// MapExperience's search-match effect). A horizontally paged carousel,
// each page a plain vertical list (same row style as Favourites/Visited
// elsewhere in the app — no boxed tiles, just rows with a divider between
// them). Swipe/trackpad scroll works, but a mouse has no swipe gesture at
// all, so explicit prev/next arrow buttons are the only way a desktop
// mouse user can reach page 2+ — the dots alone are just a position
// indicator, not controls.
export default function SearchResultsPanel({ label, places, onSelect, onClose, pageSize = DEFAULT_PAGE_SIZE }: SearchResultsPanelProps) {
  const pages = chunk(places, pageSize);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);

  // pageSize can change at runtime (the shrink-to-fit effect in
  // MapExperience), which changes how many pages there are — snap back to
  // the first page rather than leaving pageIndex pointing past the end.
  // Adjusted during render (React's recommended pattern for "state driven
  // by a prop") rather than in an effect, which would apply it a frame
  // late. The scroller's own scrollLeft is a real DOM property React
  // doesn't track, so that part stays in an effect below.
  const [lastPageSize, setLastPageSize] = useState(pageSize);
  if (pageSize !== lastPageSize) {
    setLastPageSize(pageSize);
    setPageIndex(0);
  }

  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [pageSize]);

  function goToPage(index: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, index));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setPageIndex(clamped);
  }

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setPageIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="panel-elevated w-full shrink-0 overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800/80">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {label}
          </div>
          <div className="text-[11px] text-neutral-400">
            {places.length} match{places.length === 1 ? "" : "es"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="panel-close-button shrink-0 rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-200"
          aria-label="Close"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>

      {places.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-neutral-400">No pandals match that yet.</div>
      ) : (
        <div className="relative">
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          >
            {pages.map((page, i) => (
              <div
                key={i}
                className={`w-full shrink-0 snap-start divide-y divide-neutral-800/80 py-1 ${pages.length > 1 ? "px-9" : "px-2"}`}
              >
                {page.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => onSelect(place)}
                    className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-white/10"
                  >
                    {/* A live dot rather than a per-row glyph. Every row
                        here is the same kind of thing, so an icon would
                        carry no information — whether the pandal is
                        standing right now does. */}
                    <span className={`results-row-dot ${isLiveNow(place) ? "is-live" : ""}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-neutral-100">{place.name}</div>
                      <div className="truncate text-xs text-neutral-400">
                        {[place.area, seasonLabel(place)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {pages.length > 1 && (
            <>
              <button
                onClick={() => goToPage(pageIndex - 1)}
                disabled={pageIndex === 0}
                aria-label="Previous page"
                className="absolute top-1/2 left-1 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/80 text-neutral-200 shadow-md hover:bg-white/10 disabled:pointer-events-none disabled:opacity-0"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 5l-5 5 5 5" />
                </svg>
              </button>
              <button
                onClick={() => goToPage(pageIndex + 1)}
                disabled={pageIndex === pages.length - 1}
                aria-label="Next page"
                className="absolute top-1/2 right-1 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/80 text-neutral-200 shadow-md hover:bg-white/10 disabled:pointer-events-none disabled:opacity-0"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M8 5l5 5-5 5" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {pages.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-2.5">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              aria-label={`Go to page ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === pageIndex ? "w-4 bg-[var(--accent-live)]" : "w-1.5 bg-neutral-600 hover:bg-neutral-400"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
