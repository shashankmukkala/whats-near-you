"use client";

import type { Billboard } from "@/lib/supabase";

type AircraftAdOverlayProps = {
  billboards: Billboard[];
  selectedId: string | null;
  onSelect: (billboard: Billboard) => void;
};

export default function AircraftAdOverlay({ billboards, selectedId, onSelect }: AircraftAdOverlayProps) {
  const aircraftAds = billboards.filter((billboard) => billboard.ad_type === "aircraft").slice(0, 2);
  if (aircraftAds.length === 0) return null;

  return (
    <div className="aircraft-ad-lane pointer-events-none absolute inset-x-0 top-[13%] z-20 overflow-hidden" aria-label="Sponsored aircraft ads">
      {aircraftAds.map((billboard, index) => (
        <button
          key={billboard.id}
          type="button"
          className={`aircraft-ad ${index % 2 === 1 ? "aircraft-ad-reverse" : ""} ${selectedId === billboard.id ? "aircraft-ad-selected" : ""}`}
          style={{ animationDelay: `${index * 11}s` }}
          onClick={() => onSelect(billboard)}
          aria-label={`Open sponsored placement ${billboard.name}`}
        >
          <span className="aircraft-ad-banner">
            {billboard.image_url && (
              // Advertiser URLs are user-managed remote assets.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={billboard.image_url} alt="" />
            )}
            <span>{billboard.name}</span>
          </span>
          <span className="aircraft-ad-tow-line" aria-hidden="true" />
          <span className="aircraft-ad-plane" aria-hidden="true">
            <svg viewBox="0 0 52 30" fill="none">
              <path d="M3 16.5h17.5L29 4.5c.7-1 2.2-.6 2.3.6l.8 11.4h12.4c3.1 0 5.7 2.1 6.5 5H31.8l-.7 5.3c-.1 1.1-1.6 1.5-2.2.5l-6.2-5.8H3c-1.7 0-2.3-2.2-1-3.2l1-.8Z" fill="currentColor" />
              <path d="M31 16.5h14.5c3.1 0 5.7 2.1 6.5 5H31.8" stroke="rgba(255,255,255,.65)" strokeWidth="1.2" />
            </svg>
          </span>
        </button>
      ))}
    </div>
  );
}
