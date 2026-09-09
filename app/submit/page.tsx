"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LocationPicker from "@/components/LocationPicker";
import PhotoUpload from "@/components/PhotoUpload";

export default function SubmitPage() {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [knownFor, setKnownFor] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const ready = name.trim().length >= 2 && contactPhone.replace(/\D/g, "").length >= 10 && !!coords;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          area,
          address,
          known_for: knownFor,
          image_url: imageUrl,
          media_url: mediaUrl,
          contact_phone: contactPhone,
          lng: coords!.lng,
          lat: coords!.lat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send that.");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <main className="min-h-dvh bg-[var(--cream-100)]">
        <SiteHeader active="submit" />
        <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
          <div className="card-elevated px-7 py-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-info-tint)] text-2xl text-[var(--accent-info)]">
              ✓
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-[var(--ink)]">Thank you.</h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
              We&apos;ll check the details and put it on the map. If anything needs confirming, we&apos;ll
              call the number you gave us.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <Link href="/map" className="btn-primary">
                Back to the map
              </Link>
              <button type="button" onClick={() => window.location.reload()} className="btn-secondary">
                Add another
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--cream-100)]">
      <SiteHeader active="submit" />

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <span className="section-eyebrow">Add a pandal</span>
        <h1 className="mt-3 text-[2rem] leading-tight font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
          Let the whole city find yours.
        </h1>
        <p className="mt-3 text-[15px] text-[var(--ink-muted)]">Takes a minute, and it is free.</p>

        <form onSubmit={submit} className="card-elevated mt-8 p-6 sm:p-8">
          <PhotoUpload value={imageUrl} onChange={setImageUrl} label="Photo of the pandal" />

          <label className="admin-label mt-6">
            Pandal or association name <span className="text-[var(--accent-deep)]">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input mt-1.5"
            placeholder="e.g. Ramnagar Ka Raja"
          />

          <label className="admin-label mt-5">
            Contact phone <span className="text-[var(--accent-deep)]">*</span>
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="field-input mt-1.5"
            placeholder="10-digit mobile number"
          />
          <p className="mt-1.5 text-[11.5px] text-[var(--ink-soft)]">
            So we can check with you. Never shown on the site.
          </p>

          <div className="mt-6">
            <label className="admin-label">
              Location <span className="text-[var(--accent-deep)]">*</span>
            </label>
            <p className="mt-1 mb-2 text-[11.5px] text-[var(--ink-soft)]">
              This is exactly what Directions opens, so it is worth getting right.
            </p>
            <LocationPicker value={coords} onChange={setCoords} />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="admin-label">Area</label>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="field-input mt-1.5"
                placeholder="Ram Nagar"
              />
            </div>
            <div>
              <label className="admin-label">Street or landmark</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="field-input mt-1.5"
                placeholder="Near the water tank"
              />
            </div>
          </div>

          <label className="admin-label mt-5">Anything else</label>
          <textarea
            value={knownFor}
            onChange={(e) => setKnownFor(e.target.value)}
            rows={3}
            className="field-input mt-1.5"
            placeholder="The idol, the decorations, how long it has been running."
          />

          <label className="admin-label mt-5">Instagram or reel link</label>
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            className="field-input mt-1.5"
            placeholder="https://instagram.com/…"
          />

          {error && <p className="mt-4 text-xs text-[#c22b1f]">{error}</p>}

          <button type="submit" disabled={!ready || status === "sending"} className="btn-primary mt-7 w-full">
            {status === "sending" ? "Sending…" : "Submit, it is free"}
          </button>
          <p className="mt-3 text-center text-[11.5px] text-[var(--ink-soft)]">
            Checked by a person before it appears on the map.
          </p>
        </form>
      </div>
    </main>
  );
}
