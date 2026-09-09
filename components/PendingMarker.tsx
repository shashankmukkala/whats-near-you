"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";

type PendingMarkerProps = {
  map: MapLibreMap | null;
  coords: { lng: number; lat: number } | null;
  onDragEnd: (coords: { lng: number; lat: number }) => void;
};

// The pin an admin is currently placing, shown live on the map (draggable,
// so it can be nudged onto the actual building) instead of the form just
// echoing back raw lat/lng numbers with nothing to visually confirm them.
export default function PendingMarker({ map, coords, onDragEnd }: PendingMarkerProps) {
  const markerRef = useRef<Marker | null>(null);
  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  useEffect(() => {
    if (!map || !coords) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "pending-pin";
      const marker = new Marker({ element: el, anchor: "bottom", draggable: true })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        onDragEndRef.current({ lng, lat });
      });
      markerRef.current = marker;
      return;
    }

    markerRef.current.setLngLat([coords.lng, coords.lat]);
  }, [map, coords]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, []);

  return null;
}
