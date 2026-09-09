"use client";

import { useState } from "react";
import type { AdminPlace, Place } from "@/lib/supabase";
import { fromIstDateInput, toIstDateInput } from "@/lib/season";
import PhotoUpload from "@/components/PhotoUpload";

type Props = {
  place: Place;
  /**
   * The admin console's own session token (lib/useAdminAuth). This
   * component only ever renders for an admin, but it is mounted inside
   * PlaceCard/MapExperience, which are shared with the public site — so
   * it cannot call useAdminAuth itself without also mounting the admin
   * Supabase client's listeners on every public page load. Threaded down
   * from MapExperience instead.
   */
  accessToken: string | null;
  onSaved: (place: AdminPlace) => void;
};

/**
 * Admin-only correction panel, opened from the card on the map rather
 * than a separate CRUD screen — the operator sees exactly what a visitor
 * sees, edits it in place, and the change is live on the public map
 * immediately because both read the same row.
 *
 * Archiving lives here rather than a delete button. A past season's
 * pandals are the record of how long a pandal has been running, which is
 * the kind of thing only we would know, so retiring one hides it from the
 * default view without destroying it.
 */
export default function EditPandalDetails({ place, accessToken, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [knownFor, setKnownFor] = useState(place.known_for ?? "");
  const [theme, setTheme] = useState(place.theme ?? "");
  const [area, setArea] = useState(place.area ?? "");
  const [mediaUrl, setMediaUrl] = useState(place.media_url ?? "");
  const [imageUrl, setImageUrl] = useState(place.image_url ?? "");
  const [tagsText, setTagsText] = useState(place.tags.join(", "));
  const [startsAt, setStartsAt] = useState(toIstDateInput(place.starts_at));
  const [endsAt, setEndsAt] = useState(toIstDateInput(place.ends_at));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archived = !!place.archived_at;

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "save failed");
      }
      onSaved(await res.json());
      return true;
    } catch {
      setError("Couldn't save. Check your admin session and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await patch({
      area: area.trim() || null,
      known_for: knownFor.trim() || null,
      theme: theme.trim() || null,
      media_url: mediaUrl.trim() || null,
      image_url: imageUrl.trim() || null,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      starts_at: fromIstDateInput(startsAt, "start"),
      ends_at: fromIstDateInput(endsAt, "end"),
    });
    if (ok) setOpen(false);
  }

  if (!open) {
    return (
      <div className="admin-edit-footer">
        <button type="button" onClick={() => setOpen(true)} className="admin-btn-ghost">
          Edit pandal
        </button>
        {archived && <span className="admin-archived-flag">Archived</span>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="admin-edit-panel">
      <label className="admin-label">Area</label>
      <input value={area} onChange={(e) => setArea(e.target.value)} className="admin-input" />

      <label className="admin-label mt-3">Known for</label>
      <textarea value={knownFor} onChange={(e) => setKnownFor(e.target.value)} rows={3} className="admin-input" />

      <label className="admin-label mt-3">This year&apos;s theme</label>
      <textarea value={theme} onChange={(e) => setTheme(e.target.value)} rows={2} className="admin-input" />

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

      <label className="admin-label mt-3">Photo / video / reel link</label>
      <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} className="admin-input" />

      {/* Uploads to Supabase Storage and stores the URL — never a base64
          data URL inside the row. The project this is adapted from did the
          latter and returned every photo on every page load. */}
      <div className="mt-3">
        <PhotoUpload value={imageUrl} onChange={setImageUrl} label="Photo" />
      </div>

      <label className="admin-label mt-3">Tags</label>
      <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className="admin-input" placeholder="Comma separated" />

      {error && <p className="mt-2 text-xs text-[#c22b1f]">{error}</p>}

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => patch({ archived_at: archived ? null : new Date().toISOString() })}
          className="admin-btn-ghost"
        >
          {archived ? "Restore" : "Archive"}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="admin-btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="admin-btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
