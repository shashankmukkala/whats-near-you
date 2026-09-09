"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import MapView from "@/components/Map";
import PlaceMarkers from "@/components/PlaceMarkers";
import PendingMarker from "@/components/PendingMarker";
import BillboardLayer from "@/components/BillboardLayer";
import BillboardMarkers from "@/components/BillboardMarkers";
import AircraftAdOverlay from "@/components/AircraftAdOverlay";
import PlacePandalForm from "@/components/PlacePandalForm";
import PlaceBillboardForm from "@/components/PlaceBillboardForm";
import PlaceRailAdForm from "@/components/PlaceRailAdForm";
import PlaceEventForm from "@/components/PlaceEventForm";
import TopBar from "@/components/TopBar";
import SearchResultsPanel from "@/components/SearchResultsPanel";
import type { SearchGroupMatch } from "@/components/SearchBox";
import Sidebar from "@/components/Sidebar";
import EventsPanel from "@/components/EventsPanel";
import PlaceCard from "@/components/PlaceCard";
import MapAttribution from "@/components/MapAttribution";
import AdRail from "@/components/AdRail";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { adminFetch } from "@/lib/adminFetch";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { distanceMeters } from "@/lib/geo";
import { isCurrent, isLiveNow, istToday } from "@/lib/season";
import { deriveAreas, deriveTags } from "@/lib/vocabulary";
import { activeBillboards } from "@/lib/adFilter";
import type { AdminPlace, Billboard, CityEvent, Place } from "@/lib/supabase";

type PlacingMode = "pandal" | "billboard" | "aircraft" | "rail" | null;
type Selected = { kind: "place"; item: Place } | { kind: "billboard"; item: Billboard } | null;

type MapExperienceProps = {
  /**
   * Public visitors browse only — there is no way to pin a pandal or
   * place a billboard. Only the admin build (app/admin) can create
   * either; both read and write the same Supabase tables, so anything
   * added in admin shows up here immediately and vice versa.
   */
  isAdmin: boolean;
};

export default function MapExperience({ isAdmin }: MapExperienceProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [placingMode, setPlacingMode] = useState<PlacingMode>(null);
  const [pendingCoords, setPendingCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [liveOnly, setLiveOnly] = useState(false);
  // 0 = "Any" (no distance filter). Picking a real radius the first time
  // triggers a one-off geolocation request — see selectMaxDistance.
  const [maxDistanceKm, setMaxDistanceKm] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "denied">("idle");
  const [selected, setSelected] = useState<Selected>(null);
  const [searchMatch, setSearchMatch] = useState<SearchGroupMatch>(null);
  const [searchClearSignal, setSearchClearSignal] = useState(0);
  const [searchDismissDropdownSignal, setSearchDismissDropdownSignal] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [resultsPageSize, setResultsPageSize] = useState(5);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const rightColumnRef = useRef<HTMLDivElement>(null);

  // Only ever holds a session on /admin — a separate client and
  // localStorage key from anything else (see lib/supabase.ts's
  // adminSupabase), so this reads as signed-out on the public map and is
  // safe to call unconditionally. Threaded down into PlaceCard's
  // admin-only edit form, which cannot call this itself without mounting
  // the admin client's listeners on every public page load too.
  const { session: adminSession } = useAdminAuth();
  const adminAccessToken = adminSession?.access_token ?? null;

  useEffect(() => {
    // The admin console reads the same endpoint with its token, which
    // returns the internal research fields and the archived rows too.
    const init: RequestInit = adminAccessToken
      ? { headers: { Authorization: `Bearer ${adminAccessToken}` } }
      : {};
    fetch("/api/places", init)
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setPlaces(data))
      .catch(() => {});
    fetch("/api/billboards")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setBillboards(data))
      .catch(() => {});
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setEvents(data))
      .catch(() => {});
  }, [adminAccessToken]);

  // A campaign that has ended stops rendering. The reference project only
  // *reported* campaign_end (the rail used it to say when a slot frees
  // up) and kept showing the placement forever, which on a festival map
  // would mean last year's sponsor still flying overhead.
  const liveBillboards = useMemo(() => activeBillboards(billboards), [billboards]);

  // The time dimension, applied once at the top. Everything downstream —
  // filters, search, the map, the vocabularies — works from this, so a
  // finished pandal cannot leak into a filter chip or a search result.
  // Admin sees everything, archived rows included, because correcting
  // last season's data is part of the job.
  const seasonPlaces = useMemo(() => (isAdmin ? places : places.filter((p) => isCurrent(p))), [places, isAdmin]);

  const areaVocabulary = useMemo(() => deriveAreas(seasonPlaces), [seasonPlaces]);
  const tagVocabulary = useMemo(() => deriveTags(seasonPlaces), [seasonPlaces]);

  // Everything except the area filter. Search is matched against this, so
  // an area named in the query reconciles with (replaces) a manually
  // picked area chip instead of being ANDed into an impossible
  // combination — a place has exactly one area, so searching "balapur"
  // inside a list already narrowed to Ram Nagar could only ever find
  // nothing.
  const areaAgnosticPlaces = useMemo(() => {
    let result = seasonPlaces;
    if (liveOnly) result = result.filter((p) => isLiveNow(p));
    if (activeTags.size > 0) {
      result = result.filter((p) => [...activeTags].every((tag) => p.tags.includes(tag)));
    }
    if (maxDistanceKm > 0 && userLocation) {
      const maxMeters = maxDistanceKm * 1000;
      result = result.filter((p) => distanceMeters(userLocation, { lat: p.lat, lng: p.lng }) <= maxMeters);
    }
    return result;
  }, [seasonPlaces, liveOnly, activeTags, maxDistanceKm, userLocation]);

  const visiblePlaces = useMemo(() => {
    if (!activeArea) return areaAgnosticPlaces;
    return areaAgnosticPlaces.filter((p) => p.area === activeArea);
  }, [areaAgnosticPlaces, activeArea]);

  // Search and the manual chips COMBINE rather than one clearing the
  // other: a typed "live" plus a picked area both narrow the same list.
  const displayedPlaces = searchMatch
    ? activeArea
      ? searchMatch.places.filter((p) => p.area === activeArea)
      : searchMatch.places
    : visiblePlaces;

  // The results panel appears whenever ANY criterion is active — manual
  // chip or typed query — combining both into one label.
  const resultsMatch: SearchGroupMatch = (() => {
    const parts: string[] = [];
    if (liveOnly) parts.push("● Live now");
    if (activeArea) parts.push(`📍 ${activeArea}`);
    for (const tag of activeTags) parts.push(tag);
    if (maxDistanceKm > 0) parts.push(`📏 <${maxDistanceKm}km`);
    if (searchMatch?.label) parts.push(searchMatch.label);
    if (parts.length === 0) return null;
    return { label: parts.join(" · "), places: displayedPlaces };
  })();

  // News is supporting content, not the main event: it shows only when
  // fewer than two "real" panels (an open pandal card, a results list)
  // are already on screen, so it never piles a third panel on top and is
  // never left alone with nothing beside it either.
  const realPanelCount = (selected ? 1 : 0) + (resultsMatch ? 1 : 0);
  const showEvents = realPanelCount < 2;
  const upcomingEventCount = events.filter((e) => e.event_date >= istToday()).length;

  // The results carousel shows 5 rows, but that only fits when it is the
  // only panel in the column. Once a card is stacked above it (or the
  // window is short), 5 rows push the column past the viewport and force
  // a scrollbar — so shrink until the column's own content fits.
  // `panelShapeKey` resets back to 5 whenever what is on screen changes,
  // since a new combination might fit more, not less; the effect below
  // shrinks again from there. That is what avoids getting stuck shrunk.
  const panelShapeKey = `${!!selected}-${resultsMatch ? resultsMatch.places.length : 0}-${showEvents}`;
  // Reset adjusted during render (React's documented pattern for state
  // driven by a derived value) rather than in an effect, which would
  // apply it a frame late.
  const [lastPanelShapeKey, setLastPanelShapeKey] = useState(panelShapeKey);
  if (panelShapeKey !== lastPanelShapeKey) {
    setLastPanelShapeKey(panelShapeKey);
    setResultsPageSize(5);
  }

  // useLayoutEffect so this measures and corrects before the browser
  // paints — a passive effect would let the overflowing layout flash on
  // screen for a frame. Floor of 1, so it keeps shrinking as far as it
  // takes; a single-row page is still a usable carousel.
  useLayoutEffect(() => {
    if (!resultsMatch) return;
    const el = rightColumnRef.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 1 && resultsPageSize > 1) {
      setResultsPageSize((n) => Math.max(1, n - 1));
    }
  }, [resultsPageSize, panelShapeKey, resultsMatch]);

  // On a phone every panel wants most of the screen, so exactly one is
  // visible: the most specific thing the visitor last acted on.
  //
  // Derived rather than tracked. A flag set inside one function means
  // only that one entry point participates — opening a panel from
  // somewhere else stacks two full-height sheets, because the new call
  // site never learned about the rule. A derived value cannot be
  // forgotten by a new call site.
  //
  // Priority is most-specific-first: one pandal beats a list of pandals,
  // and either beats the news filler. Admin is excluded — it is a desktop
  // workspace where stacking is the point.
  const singlePanelMode = isMobile && !isAdmin;
  const mobilePanel = selected ? "detail" : resultsMatch ? "results" : eventsOpen ? "events" : null;
  const canShow = (panel: "detail" | "results" | "events") => !singlePanelMode || mobilePanel === panel;

  // Any panel overlaying the map, which is also what tells CSS to move
  // the ad rail out of a sheet's way.
  const hasOpenPanel = !!selected || !!resultsMatch || eventsOpen;

  // --- Deep links: ?place=<id> -------------------------------------------
  //
  // A shared link has to reopen the pandal it was shared from. Most people
  // arriving at a festival map arrive through a forward from someone else,
  // so this is the main entrance, not a convenience.
  //
  // Waits for BOTH the rows and the map: `places` because the id has to be
  // resolved against real data, and `map` because selectPlace flies the
  // camera and MapLibre silently ignores a flyTo issued before load. The
  // ref (not state) means this can only ever fire once — re-running it
  // after the visitor has navigated elsewhere would yank them back to the
  // link they arrived on.
  //
  // Looked up in `places`, deliberately not `displayedPlaces`: a link must
  // still open its pandal even when a filter would have hidden it.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const wanted = new URLSearchParams(window.location.search).get("place");
    if (!wanted) {
      deepLinkHandled.current = true;
      return;
    }
    if (!map || places.length === 0) return;

    deepLinkHandled.current = true;
    const match = places.find((p) => p.id === wanted);
    if (match) {
      selectPlace(match);
    } else {
      // Archived, deleted, or a mangled forward. Drop the parameter rather
      // than leaving the address bar claiming a pandal that is not open —
      // the selection effect below cannot do it, since nothing changed.
      const url = new URL(window.location.href);
      url.searchParams.delete("place");
      window.history.replaceState(null, "", url);
    }
    // selectPlace is stable enough for this one-shot: it is recreated each
    // render, and including it would defeat the run-once guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, places]);

  // Keeps the address bar honest as you browse, so copying the URL gives
  // the pandal actually on screen. Without it, a visitor who arrived on a
  // shared link and then tapped a different pin would copy the ORIGINAL
  // link out of the address bar and forward the wrong place on — which is
  // the same broken-share bug wearing a different hat.
  //
  // replaceState, not pushState: browsing pins is not navigation, and
  // stacking history entries would turn the phone's back button into a
  // walk back through every pin tapped instead of a way out of the map.
  // Gated on the deep link having been dealt with, or this would strip the
  // incoming parameter on first paint, before it was ever read.
  useEffect(() => {
    if (!deepLinkHandled.current) return;
    const url = new URL(window.location.href);
    if (selected?.kind === "place") url.searchParams.set("place", selected.item.id);
    else url.searchParams.delete("place");
    window.history.replaceState(null, "", url);
  }, [selected]);

  // Padding passed to flyTo/fitBounds is persistent camera state, not a
  // one-off argument — MapLibre keeps it on the transform. Without this
  // the offset applied when a card opened would survive the card being
  // dismissed, leaving the map permanently shifted and every later
  // recentre landing further off to one side.
  useEffect(() => {
    if (!map || hasOpenPanel) return;
    map.easeTo({ padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration: 220 });
  }, [map, hasOpenPanel]);

  // Escape closes the topmost panel, innermost first, so repeated presses
  // unwind the stack in the order it was built rather than clearing
  // everything at once.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (selected) setSelected(null);
      else if (resultsMatch) clearAllFilters();
      else if (eventsOpen) setEventsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected, resultsMatch, eventsOpen]);

  useEffect(() => {
    const el = rightColumnRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Observes the column's own CSS-bounded box, not its content — adding
    // rows changes scrollHeight but not this, so it cannot loop with the
    // shrink effect above.
    const ro = new ResizeObserver(() => setResultsPageSize(5));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The results panel's X clears everything that produced it — the typed
  // query AND every chip — so it always actually closes. A partial clear
  // left the panel on screen relabelled instead of dismissed, which reads
  // as "the close button doesn't work". The query text goes too, so a
  // stale query cannot silently re-match and reopen the panel a moment
  // later.
  function clearAllFilters() {
    setSearchMatch(null);
    setActiveArea(null);
    setActiveTags(new Set());
    setLiveOnly(false);
    setMaxDistanceKm(0);
    setSearchClearSignal((n) => n + 1);
  }

  // Touching a chip while a search is active updates the results, but the
  // search box would still show the old text describing results that no
  // longer match it. Clearing it keeps the two from visibly disagreeing.
  function clearSearchIfActive() {
    if (!searchMatch) return;
    setSearchMatch(null);
    setSearchClearSignal((n) => n + 1);
  }

  // Panels overlay the map rather than sitting beside it — the canvas is
  // `position: absolute; inset: 0`, so it fills the viewport and cards
  // float on top. Centring a pin in the container's geometric middle
  // therefore drops it *underneath* whatever just opened: behind the
  // bottom sheet on a phone, behind the right column on desktop. You
  // would open a card about a pandal and not be able to see the pandal.
  //
  // Padding moves the camera's idea of "centre" into the region still
  // visible, which is what every native map app does when it raises a
  // place sheet. Measured from the live container rather than hardcoded,
  // so it stays right across rotation and split-screen.
  function cameraPadding() {
    const container = map?.getContainer();
    if (!container) return undefined;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (isMobile) {
      // The top bar and ticker sit over the map's top edge; the sheet
      // takes the bottom. Clamped so the two never squeeze the visible
      // strip below ~140px, which MapLibre needs to place a camera at all.
      const top = Math.min(150, height * 0.22);
      const bottom = Math.max(0, Math.min(height * 0.55, height - top - 140));
      return { top, bottom, left: 16, right: 16 };
    }

    return { top: 96, bottom: 32, left: 32, right: Math.min(420, width * 0.42) };
  }

  function fitMapToPlaces(target: Place[]) {
    if (!map || target.length === 0) return;
    const lngs = target.map((p) => p.lng);
    const lats = target.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: cameraPadding() ?? 120, maxZoom: 15, duration: 700 }
    );
  }

  // Zooms to fit whatever the filters match, so changing one shows *where*
  // those pandals actually cluster instead of leaving the view wherever it
  // happened to be. Skipped on first render — the map already opens on the
  // densest cluster deliberately, and rows loading in is not a filter
  // change.
  const didFitOnFilterChange = useRef(false);
  useEffect(() => {
    if (!didFitOnFilterChange.current) {
      didFitOnFilterChange.current = true;
      return;
    }
    fitMapToPlaces(visiblePlaces);
    // visiblePlaces deliberately excluded — this reacts to the controls
    // changing, not to every recompute of the filtered list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activeArea, activeTags, liveOnly, maxDistanceKm]);

  function handleGroupMatch(match: SearchGroupMatch) {
    setSearchMatch(match);
    if (!match) return;
    let target = match.places;
    if (activeArea) target = target.filter((p) => p.area === activeArea);
    fitMapToPlaces(target);
  }

  // Closes the open card, which is the gesture people reach for first.
  // Marker clicks call stopPropagation (see PlaceMarkers), so picking a
  // different pin does not land here and cannot close the card it just
  // opened.
  function handleMapClick(lngLat: { lng: number; lat: number }) {
    if (isAdmin && placingMode && placingMode !== "aircraft") {
      setPendingCoords(lngLat);
      return;
    }
    if (selected) setSelected(null);
  }

  function cancelPlacement() {
    setPendingCoords(null);
    setPlacingMode(null);
  }

  function toggleMode(mode: PlacingMode) {
    if (!isAdmin) return;
    setPlacingMode((current) => (current === mode ? null : mode));
    setPendingCoords(null);
    setSelected(null);
  }

  // Changing a filter means "show me a different set", so the pandal that
  // was open is stale context — on a phone it also sits directly on top
  // of the results the filter just produced. Desktop keeps the card,
  // where the column has room for both.
  function startFilterChange() {
    clearSearchIfActive();
    if (singlePanelMode) setSelected(null);
  }

  function toggleTag(tag: string) {
    startFilterChange();
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function selectAreaManually(area: string | null) {
    startFilterChange();
    setActiveArea(area);
  }

  function toggleLiveOnly(next: boolean) {
    startFilterChange();
    setLiveOnly(next);
  }

  // Distance is unlike the other chips — it needs the visitor's own
  // location before it can filter anything, so picking a radius the first
  // time (or after a denial) triggers a geolocation request rather than
  // immediately updating state. `userLocation` is cached and reused for
  // every later radius pick in the same session, so the prompt happens
  // once. "Any" (km === 0) just clears the filter and needs no location.
  function selectMaxDistance(km: number) {
    startFilterChange();
    if (km === 0) {
      setMaxDistanceKm(0);
      return;
    }
    if (userLocation) {
      setMaxDistanceKm(km);
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMaxDistanceKm(km);
        setLocationStatus("idle");
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function selectPlace(place: Place) {
    // Picking a pandal from anywhere but the search box's own dropdown
    // (a results row, a map marker) should still close that dropdown if
    // it happened to be open — it has nothing to do with what was just
    // picked, and was otherwise left sitting under the search bar with no
    // way to dismiss it.
    setSearchDismissDropdownSignal((n) => n + 1);
    if (selected?.kind === "place" && selected.item.id === place.id) {
      setSelected(null);
      return;
    }
    setSelected({ kind: "place", item: place });
    map?.flyTo({
      center: [place.lng, place.lat],
      zoom: Math.max(map.getZoom(), 16),
      padding: cameraPadding(),
      essential: true,
    });
  }

  function selectBillboard(billboard: Billboard) {
    if (selected?.kind === "billboard" && selected.item.id === billboard.id) {
      setSelected(null);
      return;
    }
    setSelected({ kind: "billboard", item: billboard });
    if (billboard.ad_type !== "rail") {
      map?.flyTo({
        center: [billboard.lng, billboard.lat],
        zoom: Math.max(map.getZoom(), 16),
        padding: cameraPadding(),
        essential: true,
      });
    }
  }

  async function deleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      await adminFetch(`/api/events/${id}`, { method: "DELETE" });
    } catch {
      // best-effort — it stays removed from view even if the request fails
    }
  }

  function startAircraftPlacement() {
    if (!isAdmin || !map) return;
    const center = map.getCenter();
    setPlacingMode("aircraft");
    setPendingCoords({ lng: center.lng, lat: center.lat });
    setSelected(null);
  }

  function handleExplore() {
    setSelected(null);
    setEventsOpen(false);
    clearAllFilters();
    setPlacingMode(null);
    setPendingCoords(null);
  }

  return (
    // `has-open-panel` lets CSS get out of the way of a sheet on small
    // screens — chiefly the ad rail, which shares the exact same bottom
    // offset as the panel column and was otherwise covered by an open
    // card rather than sitting beside it. Same pattern as a native map
    // app, where bottom chrome yields to an open place sheet.
    <div
      className={`map-experience-shell relative isolate flex h-dvh w-dvw gap-1 overflow-hidden p-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] sm:gap-1.5 sm:p-2 ${isAdmin ? "is-admin" : "is-public"} ${hasOpenPanel ? "has-open-panel" : ""}`}
    >
      {/* The backdrop lives on this fixed base layer's own background, not
          a separately z-indexed child: a negative-z element only stays
          behind its siblings if some ancestor actually establishes a
          stacking context, and plain `relative` with no z-index does not
          — so the child escaped to the document root and painted
          underneath the page background, where nothing showed. `isolate`
          forces that stacking context explicitly.
          One wash, not a per-category set. Every pin here is the same kind
          of thing, so recolouring by category would be colour without
          meaning; and the obvious festival colour, saffron, is spoken for
          — the design system reserves it for advertising, and a saffron
          map would make every paid placement invisible.
          Admin gets the flat version: it is a working tool, not the
          browsing experience the wash is for. The flat version also
          covers the public map until MapView's onMapReady fires, since
          before that the canvas is transparent and the wash would sit
          fully exposed for a beat on every reload. */}
      {isAdmin || !map ? (
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,#0b0b0d_0%,#111113_55%,#0a0a0c_100%)]" />
      ) : (
        <div className="aurora-festival absolute inset-0 -z-10" />
      )}

      <div className="map-sidebar-rail">
        <Sidebar
          onExplore={handleExplore}
          onOpenNews={() => setEventsOpen(true)}
          isAdmin={isAdmin}
          publicMode={!isAdmin}
          onPlacePandal={() => toggleMode("pandal")}
          onPlaceBillboard={() => toggleMode("billboard")}
          onPlaceAircraft={startAircraftPlacement}
          onPlaceRail={() => toggleMode("rail")}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
      </div>

      <div className="map-main-shell min-h-0 flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto sm:gap-3 lg:overflow-hidden">
        {isAdmin && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-2">
            <div className="rounded-full border border-[var(--ink-line)] bg-[var(--cream-50)] px-4 py-1 text-xs font-semibold tracking-wide text-[var(--ink-muted)] uppercase shadow-sm">
              Admin mode
            </div>
          </div>
        )}

        <div className="relative z-20">
          <TopBar
            map={map}
            // Handed the list filtered by everything EXCEPT area (see
            // areaAgnosticPlaces) — an area named in the search text
            // reconciles with the manual chip rather than being searched
            // for inside an already differently-filtered list, which
            // could only ever find zero matches.
            places={areaAgnosticPlaces}
            areaVocabulary={areaVocabulary}
            tagVocabulary={tagVocabulary}
            onSelectPlace={selectPlace}
            onGroupMatch={handleGroupMatch}
            searchClearSignal={searchClearSignal}
            searchDismissDropdownSignal={searchDismissDropdownSignal}
            onMenuClick={() => setMobileNavOpen(true)}
            publicMode={!isAdmin}
            activeArea={activeArea}
            onSelectArea={selectAreaManually}
            activeTags={activeTags}
            onToggleTag={toggleTag}
            liveOnly={liveOnly}
            onToggleLiveOnly={toggleLiveOnly}
            maxDistanceKm={maxDistanceKm}
            onSelectMaxDistance={selectMaxDistance}
            locationStatus={locationStatus}
            events={events}
          />
        </div>

        {!isAdmin && (
          <button
            type="button"
            className="news-launcher"
            aria-expanded={eventsOpen}
            aria-label={
              upcomingEventCount > 0
                ? `News — ${upcomingEventCount} upcoming ${upcomingEventCount === 1 ? "item" : "items"}`
                : "News"
            }
            onClick={() => setEventsOpen((open) => !open)}
          >
            {/* Word only. The icon and the count were two filled circles
                either side of the label, which read as two badges rather
                than one control. The count goes in the accessible name
                instead of taking up space in a tab this narrow. */}
            <span>News</span>
          </button>
        )}

        <div className="map-content-layer relative z-10 flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2 lg:flex-row">
          <div className="map-canvas-shell relative h-[min(56dvh,34rem)] min-h-[18rem] min-w-0 shrink-0 overflow-hidden rounded-3xl shadow-xl sm:h-[50vh] lg:h-auto lg:flex-1">
            <MapView placingMode={placingMode} onMapClick={handleMapClick} onMapReady={setMap} showRotationControls />
            <PlaceMarkers
              map={map}
              places={displayedPlaces}
              selectedId={selected?.kind === "place" ? selected.item.id : null}
              onSelect={selectPlace}
            />
            <BillboardMarkers
              map={map}
              billboards={liveBillboards}
              selectedId={selected?.kind === "billboard" ? selected.item.id : null}
              onSelect={selectBillboard}
            />
            <AircraftAdOverlay
              billboards={liveBillboards}
              selectedId={selected?.kind === "billboard" ? selected.item.id : null}
              onSelect={selectBillboard}
            />
            <BillboardLayer map={map} billboards={liveBillboards} />
            {isAdmin && placingMode !== "aircraft" && (
              <PendingMarker map={map} coords={pendingCoords} onDragEnd={setPendingCoords} />
            )}

            <MapAttribution />

            {!isAdmin && <AdRail billboards={liveBillboards} onSelect={selectBillboard} />}

            {placingMode && !pendingCoords && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
                <div className="rounded-full bg-[image:var(--gradient-accent)] px-4 py-2 text-sm font-semibold text-[#fff8f0] shadow-lg">
                  Click anywhere on the map to {placingMode === "pandal" ? "pin a pandal" : "place a billboard"}
                </div>
              </div>
            )}
          </div>

          <div
            ref={rightColumnRef}
            className="map-panels-column flex w-full min-w-0 flex-col gap-1.5 sm:gap-2 lg:w-96 lg:shrink-0 lg:overflow-y-auto"
          >
            {isAdmin && pendingCoords && placingMode === "pandal" && (
              <PlacePandalForm
                coords={pendingCoords}
                onCancel={cancelPlacement}
                onCreated={(place) => {
                  setPlaces((prev) => [place, ...prev]);
                  cancelPlacement();
                }}
              />
            )}

            {isAdmin && placingMode === "rail" && (
              <PlaceRailAdForm
                existing={billboards}
                onCancel={cancelPlacement}
                onCreated={(billboard) => {
                  setBillboards((prev) => [billboard, ...prev]);
                  cancelPlacement();
                }}
              />
            )}

            {isAdmin && pendingCoords && (placingMode === "billboard" || placingMode === "aircraft") && (
              <PlaceBillboardForm
                coords={pendingCoords}
                initialAdType={placingMode === "aircraft" ? "aircraft" : "billboard"}
                onCancel={cancelPlacement}
                onCreated={(billboard) => {
                  setBillboards((prev) => [billboard, ...prev]);
                  cancelPlacement();
                }}
              />
            )}

            {/* The card layers ON TOP of whatever list it was opened from
                — picking a pandal out of search results should not
                replace those results, since you are likely working
                through several of them. */}
            {selected &&
              (selected.kind === "place" ? (
                <PlaceCard
                  kind="place"
                  item={selected.item}
                  onClose={() => setSelected(null)}
                  isAdmin={isAdmin}
                  adminAccessToken={adminAccessToken}
                  onPlaceUpdated={(updated: AdminPlace) => {
                    setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                    setSelected({ kind: "place", item: updated });
                  }}
                />
              ) : (
                <PlaceCard kind="billboard" item={selected.item} onClose={() => setSelected(null)} isAdmin={isAdmin} />
              ))}

            {resultsMatch && canShow("results") && (
              <SearchResultsPanel
                label={resultsMatch.label}
                places={resultsMatch.places}
                onSelect={selectPlace}
                onClose={clearAllFilters}
                pageSize={resultsPageSize}
              />
            )}

            {showEvents && (isAdmin || eventsOpen) && canShow("events") && (
              <EventsPanel
                events={events}
                isAdmin={isAdmin}
                onAddClick={() => setEventFormOpen(true)}
                onDelete={deleteEvent}
                onClose={!isAdmin ? () => setEventsOpen(false) : undefined}
              />
            )}
          </div>
        </div>
      </div>

      {isAdmin && eventFormOpen && (
        <PlaceEventForm
          onCancel={() => setEventFormOpen(false)}
          onCreated={(event) => {
            setEvents((prev) => [...prev, event].sort((a, b) => a.event_date.localeCompare(b.event_date)));
            setEventFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
