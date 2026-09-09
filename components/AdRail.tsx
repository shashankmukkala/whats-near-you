"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Billboard } from "@/lib/supabase";

type AdRailProps = {
  billboards: Billboard[];
  onSelect: (billboard: Billboard) => void;
};

const SLOT_COUNT = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdRail({ billboards, onSelect }: AdRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const activeAds = billboards.filter((billboard) => billboard.ad_type === "map").sort((a, b) => (a.slot_number ?? 99) - (b.slot_number ?? 99));

  // All 5 slots taken means there's nothing to click into — the empty-
  // slot "+" button (the only obvious "advertise here" affordance) simply
  // isn't there any more. Without this, an interested advertiser has no
  // way to tell "full right now" from "full forever," so the soonest
  // known campaign_end among live slots (set optionally in
  // PlaceRailAdForm) becomes the answer to "when's the next slot open."
  const isFull = activeAds.length >= SLOT_COUNT;
  const knownEndDates = activeAds.map((ad) => ad.campaign_end).filter((d): d is string => !!d).sort();
  const nextOpening = knownEndDates[0] ?? null;

  return (
    <div className={`ad-rail ${collapsed ? "ad-rail-collapsed" : ""}`} aria-label="Sponsored placements">
      {collapsed ? (
        <button type="button" className="ad-rail-reopen" onClick={() => setCollapsed(false)} aria-label="Show sponsored placements">
          <span aria-hidden="true">AD</span>
          <span>Sponsored</span>
          <span aria-hidden="true">⌃</span>
        </button>
      ) : (
        <>
          <div className="ad-rail-header">
            <div>
              <span className="ad-rail-kicker">SPONSORED</span>
              <strong>Discover local brands</strong>
            </div>
            <button type="button" onClick={() => setCollapsed(true)} className="ad-rail-collapse" aria-label="Collapse sponsored placements">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
          </div>
          {isFull && (
            <button
              type="button"
              onClick={() => router.push("/advertise")}
              className="ad-rail-full-notice"
              title={
                nextOpening
                  ? `All 5 slots are booked — the next one opens around ${formatDate(nextOpening)}. Click to enquire.`
                  : "All 5 slots are booked right now — click to enquire and we'll reach out when one opens."
              }
            >
              All 5 slots are full{nextOpening ? ` · next opening ~${formatDate(nextOpening)}` : " · check back soon"}
            </button>
          )}
          <div className="ad-rail-slots">
            {Array.from({ length: SLOT_COUNT }, (_, index) => {
              const ad = activeAds[index];
              return ad ? (
                <button
                  type="button"
                  key={ad.id}
                  className="ad-rail-slot ad-rail-slot-filled"
                  onClick={() => onSelect(ad)}
                  title={ad.campaign_end ? `Booked until ${formatDate(ad.campaign_end)}` : "Currently booked — no end date on file"}
                >
                  <span className="ad-rail-slot-image">
                    {ad.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ad.image_url} alt="" />
                    ) : (
                      <span>{ad.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="ad-rail-slot-copy">
                    <strong>{ad.name}</strong>
                    <small>View placement</small>
                  </span>
                  <span className="ad-rail-arrow" aria-hidden="true">↗</span>
                </button>
              ) : (
                <button type="button" key={`empty-${index}`} className="ad-rail-slot ad-rail-slot-empty" onClick={() => router.push("/advertise")}>
                  <span className="ad-rail-empty-plus" aria-hidden="true">+</span>
                  <span>Advertise here</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="ad-rail-footer" onClick={() => router.push("/advertise")}>Reach Hyderabad&apos;s festival crowds <span>·</span> <strong>Advertise</strong></button>
        </>
      )}
    </div>
  );
}
