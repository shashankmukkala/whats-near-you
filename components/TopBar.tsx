"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SearchBox, { type SearchGroupMatch } from "@/components/SearchBox";
import LiveTicker from "@/components/LiveTicker";
import type { CityEvent, Place } from "@/lib/supabase";

type TopBarProps = {
  places: Place[];
  areaVocabulary: string[];
  tagVocabulary: string[];
  onSelectPlace: (place: Place) => void;
  onGroupMatch: (match: SearchGroupMatch) => void;
  searchClearSignal?: number;
  searchDismissDropdownSignal?: number;
  onMenuClick: () => void;
  publicMode?: boolean;
  activeArea: string | null;
  onSelectArea: (area: string | null) => void;
  activeTags: Set<string>;
  onToggleTag: (tag: string) => void;
  liveOnly: boolean;
  onToggleLiveOnly: (next: boolean) => void;
  /** 0 = "Any" (no distance filter). */
  maxDistanceKm: number;
  onSelectMaxDistance: (km: number) => void;
  /** Drives the Distance chips' inline state while a geolocation request
   *  is in flight or was denied — "idle" the rest of the time. */
  locationStatus: "idle" | "locating" | "denied";
  events?: CityEvent[];
};

const DISTANCE_OPTIONS = [1, 3, 5, 8, 10, 15];

export default function TopBar({
  places,
  areaVocabulary,
  tagVocabulary,
  onSelectPlace,
  onGroupMatch,
  searchClearSignal,
  searchDismissDropdownSignal,
  onMenuClick,
  publicMode = false,
  activeArea,
  onSelectArea,
  activeTags,
  onToggleTag,
  liveOnly,
  onToggleLiveOnly,
  maxDistanceKm,
  onSelectMaxDistance,
  locationStatus,
  events = [],
}: TopBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [filtersOpen]);

  // Picking a single-choice filter is a finished action, so the panel
  // gets out of the way — it sits over the map, and leaving it open hid
  // the results the filter had just produced. Tags are excluded: they are
  // multi-select, and closing after each pick would mean reopening the
  // panel every time.
  function pickOne(apply: () => void) {
    apply();
    setFiltersOpen(false);
  }

  const activeCount = (activeArea ? 1 : 0) + activeTags.size + (maxDistanceKm > 0 ? 1 : 0) + (liveOnly ? 1 : 0);

  return (
    <div className="topbar-shell panel-elevated flex flex-wrap items-center gap-1.5 rounded-3xl px-2.5 py-2 sm:gap-2 sm:px-3 sm:py-2">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className={`menu-trigger flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${publicMode ? "" : "lg:hidden"}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <div className="topbar-search w-40 min-w-0 shrink grow sm:w-64 sm:grow-0">
        <SearchBox
          places={places}
          tagVocabulary={tagVocabulary}
          onSelectPlace={onSelectPlace}
          onGroupMatch={onGroupMatch}
          clearSignal={searchClearSignal}
          dismissDropdownSignal={searchDismissDropdownSignal}
        />
      </div>

      {events.length > 0 && (
        <div className="topbar-broadcast min-w-0 flex-1">
          <LiveTicker events={events} />
        </div>
      )}

      {/* "Live now" is a first-class control rather than one chip buried
          inside the Filters panel. On a festival map it is the single
          most-asked question, and it is the only filter whose answer
          changes on its own while you are looking at the screen. */}
      <button
        type="button"
        onClick={() => onToggleLiveOnly(!liveOnly)}
        aria-pressed={liveOnly}
        className={`live-toggle ${liveOnly ? "is-active" : ""}`}
      >
        <span className="live-toggle-dot" aria-hidden="true" />
        <span className="hidden sm:inline">Live now</span>
        <span className="sm:hidden">Live</span>
      </button>

      <div ref={filtersRef} className="topbar-filters relative">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`chip-trigger ${activeCount > 0 ? "is-active" : ""}`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5">
            <path d="M4 6h12M6 10h8M8 14h4" strokeLinecap="round" />
          </svg>
          Filters
          {activeArea && <span className="hidden max-w-24 truncate sm:inline">· {activeArea}</span>}
          {activeCount > 0 && <span className="chip-trigger-count">{activeCount}</span>}
        </button>

        {filtersOpen && (
          <div className="panel-elevated no-scrollbar absolute top-full left-0 z-20 mt-2 max-h-[70vh] w-72 max-w-[85vw] space-y-3 overflow-y-auto rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[var(--ink-muted)]">Narrow by area or distance</div>
              {activeCount > 0 && (
                <button
                  onClick={() => {
                    onSelectArea(null);
                    [...activeTags].forEach((tag) => onToggleTag(tag));
                    onSelectMaxDistance(0);
                    onToggleLiveOnly(false);
                    setFiltersOpen(false);
                  }}
                  className="filter-clear shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Areas come from the loaded rows, not a hardcoded list (see
                lib/vocabulary.ts) — a chip exists if and only if a pandal
                is actually in that area, so the two cannot drift apart
                the way a constants file and a dataset do. */}
            {areaVocabulary.length > 0 && (
              <div>
                <div className="filter-group-label">Area</div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={activeArea === null} onClick={() => pickOne(() => onSelectArea(null))}>
                    All areas
                  </Chip>
                  {areaVocabulary.map((area) => (
                    <Chip
                      key={area}
                      active={activeArea === area}
                      onClick={() => pickOne(() => onSelectArea(activeArea === area ? null : area))}
                    >
                      📍 {area}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="filter-group-label flex items-center gap-1.5">
                Distance
                {locationStatus === "locating" && <span className="normal-case text-[var(--accent-live)]">· locating…</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={maxDistanceKm === 0} onClick={() => pickOne(() => onSelectMaxDistance(0))}>
                  Any
                </Chip>
                {DISTANCE_OPTIONS.map((km) => (
                  <Chip
                    key={km}
                    active={maxDistanceKm === km}
                    onClick={() => pickOne(() => onSelectMaxDistance(maxDistanceKm === km ? 0 : km))}
                  >
                    &lt;{km}km
                  </Chip>
                ))}
              </div>
              {/* Only shown right after a denial — the chips already say
                  "pick one to filter", so a permanent hint here would be
                  noise the rest of the time. */}
              {locationStatus === "denied" && (
                <p className="mt-1.5 text-[11px] text-[#c22b1f]">
                  Couldn&apos;t get your location — check location permissions and try again.
                </p>
              )}
            </div>

            {/* Rendered only when tags exist. The v1 dataset seeds none,
                and an empty group heading over an empty row reads as
                something broken rather than something unused. */}
            {tagVocabulary.length > 0 && (
              <div>
                <div className="filter-group-label">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {tagVocabulary.map((tag) => (
                    <Chip key={tag} active={activeTags.has(tag)} onClick={() => onToggleTag(tag)}>
                      {tag}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="topbar-account ml-auto flex items-center gap-1.5">
        {publicMode && (
          <Link href="/submit" className="btn-primary hidden sm:inline-flex">
            Add a pandal
          </Link>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`filter-chip ${active ? "is-active" : ""}`}>
      {children}
    </button>
  );
}
