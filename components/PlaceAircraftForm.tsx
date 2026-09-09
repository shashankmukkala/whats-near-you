"use client";

import { useState } from "react";
import type { Billboard } from "@/lib/supabase";
import PanelShell from "@/components/PanelShell";
import { adminFetch } from "@/lib/adminFetch";
import { toIstDateInput, fromIstDateInput, SEASON_ENDS_AT } from "@/lib/season";

type PlaceAircraftFormProps = {
  /** Where the banner enters the map. Taken from the current view centre
   *  rather than a click, since an aircraft banner is not pinned to a
   *  place — it flies across. */
  coords: { lng: number; lat: number };
  onCancel: () => void;
  onCreated: (billboard: Billboard) => void;
};

/**
 * Publishes an aircraft banner — one of the two surviving ad formats.
 *
 * This replaces a combined billboard/aircraft form. With the 3D billboard
 * retired (migration 0006) the shared form was mostly branches that never
 * ran: a format select with one option left, and width/height/heading
 * inputs describing a 3D panel's geometry that the banner never used.
 *
 * The banner is a CSS/DOM overlay, not a three.js object, and always was —
 * it has to stay readable at pitch 0, which is how the map opens.
 */
export default function PlaceAircraftForm({ coords, onCancel, onCreated }: PlaceAircraftFormProps) {
  const [bannerText, setBannerText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  // Defaulted to the end of the festival rather than left blank. A banner
  // with no end date flies forever, and this is a ten-day product — see
  // lib/adFilter.ts, which stops rendering a placement once it lapses.
  const [campaignEnd, setCampaignEnd] = useState(toIstDateInput(SEASON_ENDS_AT));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = bannerText.trim();
    if (!name) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await adminFetch("/api/billboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ad_type: "aircraft",
          image_url: imageUrl.trim() || null,
          target_url: targetUrl.trim() || null,
          campaign_end: fromIstDateInput(campaignEnd, "end")?.slice(0, 10) ?? null,
          lng: coords.lng,
          lat: coords.lat,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "save failed");
      }
      onCreated(await res.json());
    } catch {
      setError("Couldn't publish this banner. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PanelShell title="Aircraft banner" onClose={onCancel}>
      <form onSubmit={handleSubmit} className="px-2 pb-2">
        <div className="admin-coords">
          Flies across the current view
          <span> · no pin, no fixed location</span>
        </div>

        <label className="admin-label mt-4">Banner text</label>
        <input
          autoFocus
          value={bannerText}
          onChange={(e) => setBannerText(e.target.value)}
          className="admin-input"
          placeholder="Sweets & savouries — 20% off this week"
        />

        <label className="admin-label mt-3">Banner image URL (optional)</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="admin-input"
          placeholder="https://…/banner.png"
        />

        <label className="admin-label mt-3">Destination URL</label>
        <input
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          className="admin-input"
          placeholder="https://brand.com/offer"
        />

        <label className="admin-label mt-3">Campaign ends</label>
        <input
          type="date"
          value={campaignEnd}
          onChange={(e) => setCampaignEnd(e.target.value)}
          className="admin-input"
        />

        {error && <p className="mt-2 text-xs text-[#c22b1f]">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="admin-btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={submitting || !bannerText.trim()} className="admin-btn-primary">
            {submitting ? "Publishing…" : "Publish banner"}
          </button>
        </div>
      </form>
    </PanelShell>
  );
}
