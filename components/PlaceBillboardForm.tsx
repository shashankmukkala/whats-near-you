"use client";

import { useState } from "react";
import type { Billboard } from "@/lib/supabase";
import PanelShell from "@/components/PanelShell";
import { adminFetch } from "@/lib/adminFetch";

type PlaceBillboardFormProps = {
  coords: { lng: number; lat: number };
  initialAdType?: Billboard["ad_type"];
  onCancel: () => void;
  onCreated: (billboard: Billboard) => void;
};

export default function PlaceBillboardForm({ coords, initialAdType = "billboard", onCancel, onCreated }: PlaceBillboardFormProps) {
  const [name, setName] = useState("");
  const [adType, setAdType] = useState<Billboard["ad_type"]>(initialAdType);
  const [bannerText, setBannerText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [widthM, setWidthM] = useState(10);
  const [heightM, setHeightM] = useState(5);
  const [headingDeg, setHeadingDeg] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const displayName = adType === "aircraft" ? bannerText.trim() : name.trim();
    if (!displayName) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await adminFetch("/api/billboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName,
          ad_type: adType,
          image_url: imageUrl || null,
          target_url: targetUrl || null,
          lng: coords.lng,
          lat: coords.lat,
          width_m: widthM,
          height_m: heightM,
          heading_deg: headingDeg,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const billboard: Billboard = await res.json();
      onCreated(billboard);
    } catch {
      setError("Couldn't save this billboard. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PanelShell title={adType === "aircraft" ? "Aircraft banner" : "Place a billboard"} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="px-2 pb-2">
        {/* Coordinates only. The reverse-geocoded address this used to
            show came from Nominatim, which resolves Indian plot-number
            addresses badly enough that the label was more often wrong
            than right — and a confidently wrong address beside a pin the
            operator is about to publish is worse than no address. */}
        {adType !== "aircraft" && (
          <div className="admin-coords">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            <span> · drag the pin on the map to adjust</span>
          </div>
        )}

        <label className="mt-4 block text-xs font-medium text-[var(--ink-muted)]">
          {adType === "aircraft" ? "Ad banner text" : "Name"}
        </label>
        <input
          autoFocus
          value={adType === "aircraft" ? bannerText : name}
          onChange={(e) => (adType === "aircraft" ? setBannerText(e.target.value) : setName(e.target.value))}
          className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          placeholder={adType === "aircraft" ? "Weekend sale · 20% off" : "Weekend Sale"}
        />

        {initialAdType === "billboard" && <label className="mt-3 block text-xs font-medium text-[var(--ink-muted)]">Ad format</label>}
        {initialAdType === "billboard" && <select
          value={adType}
          onChange={(e) => setAdType(e.target.value as Billboard["ad_type"])}
          className="mt-1 w-full rounded-md border border-[var(--ink-line)] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] dark:border-[var(--ink-line)]"
        >
          <option value="billboard">Standard billboard</option>
          <option value="aircraft">Aircraft with banner</option>
        </select>}
        {initialAdType === "billboard" && <p className="mt-1 text-[11px] text-[var(--ink-muted)]">Aircraft ads fly across the map with a branded banner behind them.</p>}


        <label className="mt-3 block text-xs font-medium text-[var(--ink-muted)]">Banner image URL</label>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          placeholder="https://.../brand-banner.png"
        />

        {adType === "aircraft" && (
          <div className="aircraft-preview mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-[0.14em] text-[var(--accent-ad)] uppercase">Live preview</span>
              <span className="text-[10px] text-[var(--ink-soft)]">Sky lane</span>
            </div>
            <div className="aircraft-preview-stage">
              <div className="aircraft-ad aircraft-ad-preview">
                <span className="aircraft-ad-banner">
                  {imageUrl && (
                    // Previewing a user-provided remote URL does not need a
                    // fixed Next image host configuration.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" />
                  )}
                  <span>{bannerText.trim() || "Your banner text"}</span>
                </span>
                <span className="aircraft-ad-tow-line" aria-hidden="true" />
                <span className="aircraft-ad-plane" aria-hidden="true">
                  <svg viewBox="0 0 52 30" fill="none">
                    <path d="M3 16.5h17.5L29 4.5c.7-1 2.2-.6 2.3.6l.8 11.4h12.4c3.1 0 5.7 2.1 6.5 5H31.8l-.7 5.3c-.1 1.1-1.6 1.5-2.2.5l-6.2-5.8H3c-1.7 0-2.3-2.2-1-3.2l1-.8Z" fill="currentColor" />
                    <path d="M31 16.5h14.5c3.1 0 5.7 2.1 6.5 5H31.8" stroke="rgba(255,255,255,.72)" strokeWidth="1.2" />
                    <path d="M31.5 8.2h5.3l-2.7 5.1" fill="#38bdf8" />
                    <circle cx="25.2" cy="16.2" r="1.1" fill="#38bdf8" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        )}

        {adType !== "aircraft" && (
          <>
            <label className="mt-3 block text-xs font-medium text-[var(--ink-muted)]">Click destination URL</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="https://brand.example/offer"
            />
          </>
        )}

        {adType !== "aircraft" && <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)]">Width (m)</label>
            <input
              type="number"
              min={1}
              value={widthM}
              onChange={(e) => setWidthM(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)]">Height (m)</label>
            <input
              type="number"
              min={1}
              value={heightM}
              onChange={(e) => setHeightM(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)]">Heading (°)</label>
            <input
              type="number"
              value={headingDeg}
              onChange={(e) => setHeadingDeg(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>}

        {adType !== "aircraft" && <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#7d356038] bg-[var(--accent-ad-tint)] px-3 py-2.5">
          <div className="billboard-compass" aria-hidden="true">
            <span className="billboard-compass-north">N</span>
            <span className="billboard-compass-arrow" style={{ transform: `rotate(${headingDeg}deg)` }} />
            <span className="billboard-compass-dot" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold tracking-[0.14em] text-[var(--accent-ad)] uppercase">Banner direction</div>
            <div className="mt-0.5 text-xs leading-4 text-[var(--ink-muted)]">Choose the face direction, then inspect it with the map rotation controls.</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <button
                  key={angle}
                  type="button"
                  onClick={() => setHeadingDeg(angle)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${headingDeg === angle ? "bg-[var(--accent-ad)] text-white" : "bg-[#2b16080f] text-[var(--ink-muted)] hover:bg-[var(--accent-tint)]"}`}
                >
                  {angle === 0 ? "N" : angle === 45 ? "NE" : angle === 90 ? "E" : angle === 135 ? "SE" : angle === 180 ? "S" : angle === 225 ? "SW" : angle === 270 ? "W" : "NW"}
                </button>
              ))}
            </div>
          </div>
        </div>}

        {error && <p className="mt-2 text-xs text-[#c22b1f]">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--accent-tint)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !(adType === "aircraft" ? bannerText.trim() : name.trim())}
            className="rounded-md bg-[var(--accent-ad)] px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Saving…" : adType === "aircraft" ? "Launch aircraft banner" : "Place billboard"}
          </button>
        </div>
      </form>
    </PanelShell>
  );
}
