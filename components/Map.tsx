"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  type ExpressionSpecification,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/mapWorker";
import {
  DEFAULT_ZOOM,
  GENERAL_POI_LAYER_IDS,
  DEFAULT_MAP_CENTER,
  KEEP_POI_CLASSES,
  MAP_BACKGROUND_COLOR,
  OPENFREEMAP_STYLE_URL,
  TELANGANA_BOUNDS,
  TELANGANA_MAX_ZOOM,
  TELANGANA_MIN_ZOOM,
} from "@/lib/mapStyle";

type PlacingMode = "pandal" | "ad" | null;

type MapProps = {
  placingMode: PlacingMode;
  onMapClick: (lngLat: { lng: number; lat: number }) => void;
  onMapReady: (map: MapLibreMap) => void;
  showRotationControls?: boolean;
};

export default function Map({ placingMode, onMapClick, onMapReady, showRotationControls = false }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotationControlRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [rotationControlsOpen, setRotationControlsOpen] = useState(false);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: TELANGANA_MIN_ZOOM,
      maxZoom: TELANGANA_MAX_ZOOM,
      maxBounds: TELANGANA_BOUNDS,
      renderWorldCopies: false,
      // Opens flat. Tilt makes clustered pins occlude each other, and
      // three of the Ram Nagar pandals sit within about two hundred
      // metres of one another — so 3D is opt-in, via the top bar's
      // toggle, which eases to DEFAULT_PITCH / DEFAULT_BEARING.
      pitch: 0,
      bearing: 0,
      // MapLibre's built-in attribution control renders a full text
      // banner over the map with no way to keep it reliably collapsed —
      // replaced with our own small "i" badge (see MapAttribution.tsx).
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");

    map.on("load", () => {
      // The map is light now, so OpenFreeMap's "liberty" style is used
      // very nearly as it ships. The runtime dark inversion that used to
      // run here — and the height-keyed charcoal building ramp and the
      // faint-white road hierarchy that were hand-tuned on top of it —
      // all existed to make a light basemap survive being turned black.
      // On a cream page none of that is wanted: the tiles already read as
      // a paper map, which is what sits well under warm glass panels.
      //
      // lib/darkenMapStyle.ts and those constants are deliberately kept in
      // the tree rather than deleted. They are a working dark map, they
      // took real tuning, and the only thing standing between here and a
      // dark theme again is this one call.
      //
      // Two adjustments remain, because they are about THIS product rather
      // than about light versus dark:
      //   - the page's own cream behind the tiles, so the seam between map
      //     and page does not read as two different whites;
      //   - the POI narrowing below, which stops OSM's unmoderated temple
      //     pins competing with the curated layer.
      map.setPaintProperty("background", "background-color", MAP_BACKGROUND_COLOR);

      const layers = map.getStyle().layers ?? [];

      for (const layerId of GENERAL_POI_LAYER_IDS) {
        const layer = layers.find((l) => l.id === layerId);
        if (!layer || layer.type !== "symbol") continue;
        const existingFilter = (layer.filter ?? true) as ExpressionSpecification | boolean;
        const combined: ExpressionSpecification = [
          "all",
          existingFilter,
          ["in", ["get", "class"], ["literal", KEEP_POI_CLASSES]],
        ];
        map.setFilter(layerId, combined);
      }

      onMapReady(map);
    });

    map.on("click", (e: MapLayerMouseEvent) => {
      onMapClickRef.current(e.lngLat);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = placingMode ? "crosshair" : "";
  }, [placingMode]);

  useEffect(() => {
    if (!rotationControlsOpen) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!rotationControlRef.current?.contains(event.target as Node)) setRotationControlsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setRotationControlsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [rotationControlsOpen]);

  function rotate(delta: number) {
    mapRef.current?.easeTo({ bearing: (mapRef.current.getBearing() + delta + 360) % 360, duration: 350 });
  }

  function tilt(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch: Math.max(0, Math.min(70, map.getPitch() + delta)), duration: 350 });
  }

  function resetView() {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 450 });
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {showRotationControls && (
        <div ref={rotationControlRef} className="map-control-stack pointer-events-auto absolute right-3 bottom-[8.75rem] z-10 sm:right-4">
          {rotationControlsOpen && (
            <div className="map-rotation-pad grid grid-cols-3 gap-1 rounded-2xl p-1.5">
              <span />
              <button type="button" onClick={() => tilt(10)} aria-label="Tilt map up" title="Tilt map up">▲</button>
              <span />
              <button type="button" onClick={() => rotate(-30)} aria-label="Rotate map left" title="Rotate left">↶</button>
              <button type="button" onClick={resetView} aria-label="Reset map rotation" title="Reset north">·</button>
              <button type="button" onClick={() => rotate(30)} aria-label="Rotate map right" title="Rotate right">↷</button>
              <span />
              <button type="button" onClick={() => tilt(-10)} aria-label="Tilt map down" title="Tilt map down">▼</button>
              <span />
            </div>
          )}
          <button
            type="button"
            className={`map-control-orb ${rotationControlsOpen ? "map-control-orb-open" : ""}`}
            onClick={() => setRotationControlsOpen((open) => !open)}
            aria-label={rotationControlsOpen ? "Close map controls" : "Open map controls"}
            aria-expanded={rotationControlsOpen}
            title={rotationControlsOpen ? "Close map controls" : "Open map controls"}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
              <path className="map-control-needle" d="m15.5 8.5-2.2 5.3-4.8 1.7 2.2-5.3 4.8-1.7Z" />
            </svg>
            <span className="sr-only">Map controls</span>
          </button>
        </div>
      )}
    </div>
  );
}
