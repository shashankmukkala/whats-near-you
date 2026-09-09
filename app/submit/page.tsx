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
  const [contactName, setContactName] = useState("");
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
          contact_name: contactName,
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
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
          Put your neighbourhood on the map.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)] sm:text-base">
          Takes about a minute, and it&apos;s free. Everything is checked by a person before it goes live,
          which is why the map is worth trusting.
        </p>

        <form onSubmit={submit} className="card-elevated mt-8 p-6 sm:p-8">
          <label className="admin-label">
            Pandal name <span className="text-[var(--accent-deep)]">*</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input mt-1.5"
            placeholder="Ramnagar Ka Raja"
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              <label className="admin-label">Full address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="field-input mt-1.5"
                placeholder="Street, landmark"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="admin-label">
              Location <span className="text-[var(--accent-deep)]">*</span>
            </label>
            <p className="mt-1 mb-2 text-xs text-[var(--ink-muted)]">
              This is what &ldquo;Directions&rdquo; will open, so it&apos;s worth getting exactly right.
            </p>
            <LocationPicker value={coords} onChange={setCoords} />
          </div>

          <div className="mt-6">
            <label className="admin-label">What is it known for?</label>
            <textarea
              value={knownFor}
              onChange={(e) => setKnownFor(e.target.value)}
              rows={3}
              className="field-input mt-1.5"
              placeholder="The idol, the decorations, how long it has been running, what draws people."
            />
          </div>

          <div className="mt-6">
            <PhotoUpload value={imageUrl} onChange={setImageUrl} label="Photo of the pandal" />
          </div>

          <div className="mt-4">
            <label className="admin-label">Instagram / reel link</label>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="field-input mt-1.5"
              placeholder="https://instagram.com/…"
            />
          </div>

          <div className="mt-8 rounded-[1.25rem] border border-[var(--ink-line)] bg-[#ffffff80] p-5">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">
              So we can check with you — never shown on the site.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="admin-label">Your name</label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="field-input mt-1.5"
                  placeholder="Association or your name"
                />
              </div>
              <div>
                <label className="admin-label">
                  Phone <span className="text-[var(--accent-deep)]">*</span>
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="field-input mt-1.5"
                  placeholder="+91 …"
                />
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-xs text-[#c22b1f]">{error}</p>}

          <div className="mt-7 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--ink-muted)]">Listing is free.</p>
            <button type="submit" disabled={!ready || status === "sending"} className="btn-primary">
              {status === "sending" ? "Sending…" : "Submit — it's free"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
