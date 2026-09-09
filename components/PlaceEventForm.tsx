"use client";

import { useState } from "react";
import type { CityEvent } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminFetch";

type PlaceEventFormProps = {
  onCancel: () => void;
  onCreated: (event: CityEvent) => void;
};

export default function PlaceEventForm({ onCancel, onCreated }: PlaceEventFormProps) {
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !eventDate) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await adminFetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          event_date: eventDate,
          location: location || null,
          description: description || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const event: CityEvent = await res.json();
      onCreated(event);
    } catch {
      setError("Couldn't save this news item. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
      <form
        onSubmit={handleSubmit}
        className="w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-white p-5 shadow-2xl dark:bg-[var(--cream-50)] dark:text-[var(--ink)]"
      >
        <h2 className="text-base font-semibold">Add a news item</h2>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Procession timings, laddu auction, road closures — anything the city should know today.</p>

        <label className="mt-4 block text-xs font-medium text-[var(--ink-muted)] dark:text-[var(--ink-muted)]">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#79e2b2] dark:border-[var(--ink-line)] dark:bg-[var(--cream-200)]"
          placeholder="Latte Art Workshop"
        />

        <label className="mt-3 block text-xs font-medium text-[var(--ink-muted)] dark:text-[var(--ink-muted)]">Date</label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#79e2b2] dark:border-[var(--ink-line)] dark:bg-[var(--cream-200)]"
        />

        <label className="mt-3 block text-xs font-medium text-[var(--ink-muted)] dark:text-[var(--ink-muted)]">
          Location (optional)
        </label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#79e2b2] dark:border-[var(--ink-line)] dark:bg-[var(--cream-200)]"
          placeholder="Roastery House, Jubilee Hills"
        />

        <label className="mt-3 block text-xs font-medium text-[var(--ink-muted)] dark:text-[var(--ink-muted)]">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-[var(--ink-line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#79e2b2] dark:border-[var(--ink-line)] dark:bg-[var(--cream-200)]"
          placeholder="What's happening, who it's for..."
        />

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
            disabled={submitting || !name.trim() || !eventDate}
            className="admin-btn-primary"
          >
            {submitting ? "Saving…" : "Add event"}
          </button>
        </div>
      </form>
    </div>
  );
}
