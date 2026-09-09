"use client";

import { useState } from "react";
import Link from "next/link";
import PhotoUpload from "@/components/PhotoUpload";
import UpiQr from "@/components/UpiQr";
import { AD_PLACEMENTS, UPI_ID, upiLink, type AdPlacementId } from "@/lib/adPlacements";

export default function AdvertiseForm({ placement }: { placement: AdPlacementId }) {
  const config = AD_PLACEMENTS[placement];

  const [brand, setBrand] = useState("");
  const [phone, setPhone] = useState("");
  const [target, setTarget] = useState("");
  const [banners, setBanners] = useState<string[]>([]);
  const [proof, setProof] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const phoneDigits = phone.replace(/\D/g, "").length;
  // Payment only appears once there is something to pay FOR. Showing a QR
  // beside empty fields invites someone to pay and then abandon the form,
  // which leaves money received against no enquiry — the one failure here
  // that is genuinely expensive to unpick.
  const detailsReady = brand.trim().length >= 2 && phoneDigits >= 10 && banners.length > 0;
  const ready = detailsReady && proof.length > 0;

  const pay = upiLink(config.priceInr, `WhatsNearYou ${config.label}`);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/ad-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brand,
          contact: phone,
          ad_format: placement,
          target_url: target,
          image_url: banners[0] ?? "",
          // Extra creatives ride along in the message so nothing an
          // advertiser paid for is silently dropped before review.
          message: banners.length > 1 ? `Additional creatives:\n${banners.slice(1).join("\n")}` : "",
          payment_proof_url: proof,
          amount_inr: config.priceInr,
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
      <div className="card-elevated p-8 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-info-tint)] text-2xl text-[var(--accent-info)]">
          ✓
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-[var(--ink)]">Sent for review.</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
          We check the payment and the creative, then put it live. We will call you on {phone} if anything needs
          confirming.
        </p>
        <Link href="/map" className="btn-primary mt-7">
          Back to the map
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card-elevated p-6 sm:p-8">
      <label className="admin-label">
        Business or brand name <span className="text-[var(--accent-deep)]">*</span>
      </label>
      <input
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        className="field-input mt-1.5"
        placeholder="Your shop, brand or association"
      />

      <label className="admin-label mt-5">
        Contact phone <span className="text-[var(--accent-deep)]">*</span>
      </label>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="field-input mt-1.5"
        placeholder="10-digit mobile number"
      />

      <label className="admin-label mt-5">Website or social link</label>
      <input
        type="url"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="field-input mt-1.5"
        placeholder="https://…"
      />
      <p className="mt-1.5 text-[11.5px] text-[var(--ink-soft)]">Tapping your ad takes people here.</p>

      <div className="mt-6">
        <label className="admin-label">
          Ad banner <span className="text-[var(--accent-deep)]">*</span>
        </label>
        <p className="mt-1 mb-2 text-[11.5px] text-[var(--ink-soft)]">{config.imageHint}</p>
        <div className="space-y-3">
          {banners.map((url, i) => (
            <PhotoUpload
              key={i}
              label=""
              value={url}
              onChange={(next) =>
                setBanners((prev) => (next ? prev.map((v, j) => (j === i ? next : v)) : prev.filter((_, j) => j !== i)))
              }
            />
          ))}
          {banners.length < config.maxImages && (
            // Keyed on the count so it REMOUNTS after each upload. Without
            // that, this uploader keeps its own preview after handing the
            // URL up, and the banner renders twice: once in the list above
            // and once still sitting in the adder.
            <PhotoUpload
              key={banners.length}
              label=""
              value=""
              onChange={(url) => url && setBanners((prev) => [...prev, url])}
            />
          )}
        </div>
      </div>

      {/* Payment, revealed. Gated on the details above rather than always
          visible — see detailsReady. */}
      <div className="mt-7 rounded-[1.25rem] border border-[var(--ink-line)] bg-[#ffffff80] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="admin-label">
            Pay ₹{config.priceInr} <span className="text-[var(--accent-deep)]">*</span>
          </span>
          <span className="text-[11.5px] text-[var(--ink-soft)]">{config.days} days from approval</span>
        </div>

        {!detailsReady ? (
          <p className="mt-3 text-[13px] text-[var(--ink-soft)]">
            Fill in the name, phone and banner above, and the payment details appear here.
          </p>
        ) : !UPI_ID ? (
          <p className="mt-3 text-[13px] text-[#c22b1f]">
            Payment is not set up yet. Call us and we will take it directly — nothing has been charged.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
            {pay && <UpiQr value={pay} />}
            <div className="min-w-0">
              <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
                Scan the code, or pay by UPI to{" "}
                <code className="font-semibold text-[var(--accent-deep)]">{UPI_ID}</code>. Then upload the screenshot
                below.
              </p>
              {/* The deep link is the phone path — it opens GPay or PhonePe
                  with the amount already filled. The QR beside it is the
                  laptop path, where this link does nothing at all. */}
              {pay && (
                <a href={pay} className="btn-primary mt-3 sm:hidden">
                  Pay ₹{config.priceInr} by UPI
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <PhotoUpload
          value={proof}
          onChange={setProof}
          label="Payment screenshot *"
        />
      </div>

      {error && <p className="mt-4 text-xs text-[#c22b1f]">{error}</p>}

      <button type="submit" disabled={!ready || status === "sending"} className="btn-primary mt-7 w-full">
        {status === "sending" ? "Sending…" : "Submit for review"}
      </button>
      <p className="mt-3 text-center text-[11.5px] text-[var(--ink-soft)]">
        Nothing goes live until a person has checked it.
      </p>
    </form>
  );
}
