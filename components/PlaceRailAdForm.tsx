"use client";

import { useState } from "react";
import type { Billboard } from "@/lib/supabase";
import PanelShell from "@/components/PanelShell";
import { adminFetch } from "@/lib/adminFetch";

type Props = { existing: Billboard[]; onCancel: () => void; onCreated: (billboard: Billboard) => void };

export default function PlaceRailAdForm({ existing, onCancel, onCreated }: Props) {
  const [slot, setSlot] = useState(1);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [campaignEnd, setCampaignEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const occupied = new Set(existing.filter((item) => item.ad_type === "rail").map((item) => item.slot_number));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || occupied.has(slot)) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await adminFetch("/api/billboards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), ad_type: "rail", slot_number: slot, image_url: imageUrl || null, target_url: targetUrl || null, campaign_end: campaignEnd || null, lng: 0, lat: 0 }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "The server could not save this rail ad.");
      }
      onCreated(await response.json());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Couldn't save this rail ad. Try again.");
    } finally { setSubmitting(false); }
  }

  return <PanelShell title="Place a rail ad" subtitle="One of five centre-map placements" onClose={onCancel}>
    <form onSubmit={submit} className="px-2 pb-2">
      <div className="rail-slot-picker"><div className="rail-form-label">Choose slot</div><div className="rail-slot-options">{[1, 2, 3, 4, 5].map((number) => <button type="button" key={number} className={slot === number ? "selected" : ""} disabled={occupied.has(number)} onClick={() => setSlot(number)}>{number}{occupied.has(number) && <small>Live</small>}</button>)}</div></div>
      <label className="mt-4 block text-xs font-medium text-neutral-600">Ad banner name</label><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" placeholder="Weekend sale" />
      <label className="mt-3 block text-xs font-medium text-neutral-600">Banner image URL</label><input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" placeholder="https://.../banner.png" />
      <label className="mt-3 block text-xs font-medium text-neutral-600">Destination URL</label><input type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" placeholder="https://brand.com/offer" />
      <label className="mt-3 block text-xs font-medium text-neutral-600">Campaign ends (optional)</label><input type="date" value={campaignEnd} onChange={(event) => setCampaignEnd(event.target.value)} className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" />
      <p className="mt-1 text-[11px] text-neutral-400">Shown to visitors as &quot;next opening&quot; once all 5 slots are full.</p>
      <p className="mt-3 rounded-xl bg-neutral-900/5 px-3 py-2 text-xs text-neutral-500 dark:bg-white/5">Rail ads do not need a map pin. Slot {slot} will appear in the centred sponsored rail.</p>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-white/10">Cancel</button><button type="submit" disabled={submitting || !name.trim() || occupied.has(slot)} className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50">{submitting ? "Saving…" : "Place rail ad"}</button></div>
    </form>
  </PanelShell>;
}
