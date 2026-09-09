"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { Billboard } from "@/lib/supabase";

type BillboardMarkersProps = {
  map: MapLibreMap | null;
  billboards: Billboard[];
  selectedId: string | null;
  onSelect: (billboard: Billboard) => void;
};

export default function BillboardMarkers({ map, billboards, selectedId, onSelect }: BillboardMarkersProps) {
  const markersRef = useRef<Map<string, { marker: Marker; el: HTMLButtonElement }>>(new globalThis.Map());
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!map) return;
    const existing = markersRef.current;
    const visibleBillboards = billboards.filter((billboard) => billboard.ad_type !== "aircraft" && billboard.ad_type !== "rail");
    const nextIds = new Set(visibleBillboards.map((billboard) => billboard.id));

    for (const [id, entry] of existing) {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        existing.delete(id);
      }
    }

    for (const billboard of visibleBillboards) {
      if (existing.has(billboard.id)) continue;

      const el = document.createElement("button");
      el.type = "button";
      el.className = `billboard-pin ${billboard.ad_type === "aircraft" ? "billboard-pin-aircraft" : ""}`;
      el.setAttribute("aria-label", `Open sponsored placement ${billboard.name}`);

      const icon = document.createElement("span");
      icon.className = "billboard-pin-icon";
      if (billboard.image_url) {
        const image = document.createElement("img");
        image.src = billboard.image_url;
        image.alt = "";
        image.addEventListener("error", () => image.remove());
        icon.appendChild(image);
      } else {
        icon.textContent = billboard.ad_type === "aircraft" ? "✈" : "AD";
      }

      const label = document.createElement("span");
      label.className = "billboard-pin-label";
      label.textContent = billboard.name;
      el.append(icon, label);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(billboard);
      });

      const marker = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([billboard.lng, billboard.lat])
        .addTo(map);
      existing.set(billboard.id, { marker, el });
    }
  }, [map, billboards]);

  useEffect(() => {
    for (const [id, entry] of markersRef.current) {
      entry.el.classList.toggle("billboard-pin-selected", id === selectedId);
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
