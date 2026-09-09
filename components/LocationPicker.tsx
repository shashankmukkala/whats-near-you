"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/mapWorker";
import {
  DEFAULT_MAP_CENTER,
  MAP_BACKGROUND_COLOR,
  OPENFREEMAP_STYLE_URL,
  TELANGANA_BOUNDS,
  TELANGANA_MAX_ZOOM,
  TELANGANA_MIN_ZOOM,
} from "@/lib/mapStyle";

type LocationPickerProps = {
  value: { lng: number; lat: number } | null;
  onChange: (coords: { lng: number; lat: number }) => void;
};

/**
 * Sets a pandal's location three ways, because on a phone, at a pandal, at
 * night, exactly one of them will be convenient:
 *
 *   - drag the pin, or tap anywhere on the map
 *   - "Use my location", for someone standing there right now
 *   - paste a Google Maps link, which is how people already share places
 *
 * The pasted link is resolved server-side (see /api/resolve-maps-link) —
 * shortened maps.app.goo.gl links carry no coordinates until the redirect
 * is followed, and the browser cannot follow it because Google sends no
 * CORS headers.
 */
export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [linkInput, setLinkInput] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "error"; message?: string }>({ kind: "idle" });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: value ? [value.lng, value.lat] : DEFAULT_MAP_CENTER,
      zoom: value ? 16 : 12,
      minZoom: TELANGANA_MIN_ZOOM,
      maxZoom: TELANGANA_MAX_ZOOM,
      maxBounds: TELANGANA_BOUNDS,
      renderWorldCopies: false,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.setPaintProperty("background", "background-color", MAP_BACKGROUND_COLOR);
    });

    // Tapping the map moves the pin. On a phone this is the gesture people
    // try first, and a picker that only responds to dragging the pin reads
    // as broken until they happen to guess.
    map.on("click", (event) => {
      onChangeRef.current({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The marker follows `value` rather than owning it, so all three input
  // methods converge on one source of truth instead of fighting.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "picker-pin";
      const marker = new Marker({ element: el, draggable: true, anchor: "bottom" })
        .setLngLat([value.lng, value.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        onChangeRef.current({ lng, lat });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
    map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 15), duration: 400 });
  }, [value]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus({ kind: "error", message: "This browser can't share a location." });
      return;
    }
    setStatus({ kind: "busy" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChangeRef.current({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setStatus({ kind: "idle" });
      },
      () => setStatus({ kind: "error", message: "Couldn't get your location — check permissions." }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function useLink() {
    if (!linkInput.trim()) return;
    setStatus({ kind: "busy" });
    try {
      const res = await fetch("/api/resolve-maps-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that link.");
      onChangeRef.current({ lng: data.lng, lat: data.lat });
      setStatus({ kind: "idle" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Couldn't read that link." });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={useMyLocation} className="btn-secondary">
          📍 Use my location
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="…or paste a Google Maps link"
            className="field-input min-w-0 flex-1"
          />
          <button type="button" onClick={useLink} disabled={!linkInput.trim()} className="btn-secondary">
            Use link
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="mt-3 h-64 w-full overflow-hidden rounded-[1.25rem] border border-[var(--ink-line)]"
      />

      <p className="mt-2 text-xs text-[var(--ink-muted)]">
        {status.kind === "busy" && "Working…"}
        {status.kind === "error" && <span className="text-[#c22b1f]">{status.message}</span>}
        {status.kind === "idle" &&
          (value
            ? `Pin set at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag it to fine-tune.`
            : "Tap the map, drag the pin, or use one of the options above.")}
      </p>
    </div>
  );
}
