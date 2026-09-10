"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { Place } from "@/lib/supabase";
import { isLiveNow } from "@/lib/season";

type PlaceMarkersProps = {
  map: MapLibreMap | null;
  places: Place[];
  selectedId: string | null;
  onSelect: (place: Place) => void;
};

/**
 * Pooled MapLibre markers: existing pins are kept and only the difference
 * is added/removed, so filtering the list does not tear down and rebuild
 * every DOM node on the map.
 *
 * The one thing added over the reference implementation is a live state.
 * On a permanent-venue map every pin is equally "there"; here the single
 * most useful thing a pin can tell you at a glance is whether the pandal
 * is standing right now, so a live one carries a coral pulse ring and a
 * dormant one is muted. Coral is the design system's live/urgency colour
 * and saffron is reserved for advertising — a live pin must never be
 * mistaken for a paid placement.
 */
export default function PlaceMarkers({ map, places, selectedId, onSelect }: PlaceMarkersProps) {
  const markersRef = useRef<Map<string, { marker: Marker; el: HTMLButtonElement }>>(new globalThis.Map());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!map) return;

    const existing = markersRef.current;
    const nextIds = new Set(places.map((p) => p.id));

    for (const [id, entry] of existing) {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        existing.delete(id);
      }
    }

    for (const place of places) {
      // Live state is re-applied below on every pass rather than only at
      // creation: a pin created before the festival opened must not stay
      // dormant-looking once it starts, and the pool deliberately keeps
      // that element alive across re-renders.
      const live = isLiveNow(place);

      const pooled = existing.get(place.id);
      if (pooled) {
        pooled.el.classList.toggle("place-pin-live", live);
        continue;
      }

      const el = document.createElement("button");
      el.type = "button";
      el.className = `place-pin${live ? " place-pin-live" : ""}`;
      el.setAttribute("aria-label", `Open ${place.name}`);

      // Every pin carries the same mark rather than the pandal's initials
      // or its own photograph. A map reads better when one kind of thing
      // looks like one kind of thing — which pandal it is comes from the
      // label and the card — and a 28px circle is far too small for a
      // photograph to be anything but a smudge. An uploaded photo still
      // leads the card, where there is room for it.
      const icon = document.createElement("span");
      icon.className = "place-pin-icon";
      const image = document.createElement("img");
      image.src = "/logo-mark.png";
      image.alt = "";
      image.decoding = "async";
      icon.appendChild(image);

      const label = document.createElement("span");
      label.className = "place-pin-label";
      label.textContent = place.name;
      el.append(icon, label);

      // stopPropagation so picking a different pin does not also register
      // as a map click, which MapExperience treats as "dismiss the open
      // card" — the card would close the instant it opened.
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(place);
      });

      const marker = new Marker({ element: el, anchor: "bottom" }).setLngLat([place.lng, place.lat]).addTo(map);
      existing.set(place.id, { marker, el });
    }
  }, [map, places]);

  useEffect(() => {
    for (const [id, entry] of markersRef.current) {
      entry.el.classList.toggle("place-pin-selected", id === selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    const existing = markersRef.current;
    return () => {
      for (const entry of existing.values()) entry.marker.remove();
      existing.clear();
    };
  }, []);

  return null;
}
