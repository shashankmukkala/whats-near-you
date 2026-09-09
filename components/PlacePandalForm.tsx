"use client";

import { useState } from "react";
import type { AdminPlace } from "@/lib/supabase";
import PanelShell from "@/components/PanelShell";
import { adminFetch } from "@/lib/adminFetch";
import { CURRENT_SEASON, SEASON_ENDS_AT, SEASON_STARTS_AT, fromIstDateInput, toIstDateInput } from "@/lib/season";

type PlacePandalFormProps = {
  coords: { lng: number; lat: number };
  onCancel: () => void;
  onCreated: (place: AdminPlace) => void;
};

/**
 * Admin-only: pins a new pandal at a coordinate clicked on the map.
 *
 * The dates default to the current season rather than being left blank.
 * They are the one thing that is easy to forget and expensive to get
 * wrong — a pandal saved with no ends_at is permanent, so it would still
 * be sitting on the map next March — and for a festival every pandal
 * shares the same window anyway. They stay editable because immersion
 * dates genuinely differ between pandals in most years.
 *
 * There is no reverse-geocode lookup here, unlike the form this is
 * adapted from. Nominatim resolved 1 of 48 Indian plot-number addresses,
 * so the suggestion it produced was wrong far more often than right, and
 * a wrong address presented as a confident default is worse than an empty
 * field.
 */
export default function PlacePandalForm({ coords, onCancel, onCreated }: PlacePandalFormProps) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [knownFor, setKnownFor] = useState("");
  const [theme, setTheme] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [startsAt, setStartsAt] = useState(toIstDateInput(SEASON_STARTS_AT));
  const [endsAt, setEndsAt] = useState(toIstDateInput(SEASON_ENDS_AT));
  const [verification, setVerification] = useState("unverified");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await adminFetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          area: area.trim() || null,
          address: address.trim() || null,
          known_for: knownFor.trim() || null,
          theme: theme.trim() || null,
          maps_url: mapsUrl.trim() || null,
          media_url: mediaUrl.trim() || null,
          tags: tagsText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          lng: coords.lng,
          lat: coords.lat,
          coord_source: "admin-pin",
          starts_at: fromIstDateInput(startsAt, "start"),
          ends_at: fromIstDateInput(endsAt, "end"),
          season: CURRENT_SEASON,
          verification_status: verification,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "save failed");
      }
      onCreated(await res.json());
    } catch {
      setError("Couldn't save this pandal. Check the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PanelShell title="Pin a pandal" onClose={onCancel}>
      <form onSubmit={handleSubmit} className="px-2 pb-2">
        <div className="admin-coords">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          <span> · drag the pin on the map to adjust</span>
        </div>

        <label className="admin-label mt-4">Pandal name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="admin-input"
          placeholder="Khairatabad Ganesh"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="admin-label">Area</label>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="admin-input"
              placeholder="Khairatabad"
            />
          </div>
          <div>
            <label className="admin-label">Season</label>
            <input value={CURRENT_SEASON} readOnly className="admin-input admin-input-readonly" />
          </div>
        </div>

        <label className="admin-label mt-3">Full address</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="admin-input"
          placeholder="Khairatabad, Hyderabad"
        />

        <label className="admin-label mt-3">Known for</label>
        <textarea
          value={knownFor}
          onChange={(e) => setKnownFor(e.target.value)}
          rows={3}
          className="admin-input"
          placeholder="Why this pandal matters — history, scale, what draws people."
        />

        <label className="admin-label mt-3">This year&apos;s theme</label>
        <textarea
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          rows={2}
          className="admin-input"
          placeholder="The concept or decoration for this season."
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="admin-label">Opens</label>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="admin-input" />
          </div>
          <div>
            <label className="admin-label">Immersion</label>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="admin-input" />
          </div>
        </div>

        <label className="admin-label mt-3">Google Maps link</label>
        <input
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
          className="admin-input"
          placeholder="https://maps.app.goo.gl/…"
        />

        <label className="admin-label mt-3">Photo / video / reel link</label>
        <input
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          className="admin-input"
          placeholder="https://instagram.com/…"
        />

        <label className="admin-label mt-3">Tags</label>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          className="admin-input"
          placeholder="Comma separated — laser show, laddu auction"
        />

        {/* Internal research field. Flagged in the UI so nobody mistakes
            it for something visitors see — it is excluded from the public
            column grants and from /api/places' select list. */}
        <label className="admin-label mt-3">
          Verification <span className="admin-internal-flag">internal only</span>
        </label>
        <select value={verification} onChange={(e) => setVerification(e.target.value)} className="admin-input">
          <option value="unverified">Not verified yet</option>
          <option value="verified">Verified by me</option>
        </select>

        {error && <p className="mt-2 text-xs text-[#c22b1f]">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="admin-btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={submitting || !name.trim()} className="admin-btn-primary">
            {submitting ? "Saving…" : "Pin pandal"}
          </button>
        </div>
      </form>
    </PanelShell>
  );
}
