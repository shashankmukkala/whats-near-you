"use client";

import Link from "next/link";
import { useState } from "react";

type AdFormat = "map_rail" | "billboard" | "aircraft";

const FORMAT_DETAILS: Record<AdFormat, { label: string; description: string }> = {
  map_rail: { label: "Five-slot map rail", description: "A compact sponsored presence in the centre of the map, on screen the whole time someone is browsing." },
  billboard: { label: "3D map billboard", description: "A landmark placement that lives at a chosen point on the map." },
  aircraft: { label: "Aircraft banner", description: "A high-attention banner that flies across the map without a location pin." },
};

const FORMAT_PRICES: Record<AdFormat, { amount: string; duration: string }> = {
  map_rail: { amount: "₹1,000", duration: "for all 5 slots" },
  billboard: { amount: "₹3,000", duration: "per campaign" },
  aircraft: { amount: "₹3,000", duration: "per campaign" },
};

export default function AdvertisePage() {
  const [format, setFormat] = useState<AdFormat>("map_rail");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/ad-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form.entries()), ad_format: format }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit enquiry.");
      setStatus("success");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit enquiry.");
      setStatus("error");
    }
  }

  return (
    <main className="advertise-page">
      <div className="advertise-glow advertise-glow-one" />
      <div className="advertise-glow advertise-glow-two" />
      <div className="advertise-layout">
        <section className="advertise-intro">
          <Link href="/" className="advertise-back">← Back to map</Link>
          <div className="advertise-brand"><span>📍</span> WhatsNearYou</div>
          <span className="ad-rail-kicker">ADVERTISE WITH US</span>
          <h1>Put your brand where Hyderabad is already looking.</h1>
          <p>During Ganesh Chaturthi the whole city is deciding where to go tonight. Reach them on the map while they decide — not after.</p>
          <div className="advertise-proof-list">
            <div><span>01</span><strong>Choose your format</strong><small>Rail, billboard, or aircraft.</small></div>
            <div><span>02</span><strong>Send your creative</strong><small>We review every placement.</small></div>
            <div><span>03</span><strong>Go live with confidence</strong><small>Your ad launches after approval.</small></div>
          </div>
        </section>

        <section className="advertise-form-card">
          {status === "success" ? (
            <div className="advertise-success">
              <div className="ad-enquiry-success-icon">✓</div>
              <span className="ad-rail-kicker">ENQUIRY RECEIVED</span>
              <h2>Your brand is on our radar.</h2>
              <p>We&apos;ll review your request and contact you before anything goes live.</p>
              <Link href="/" className="ad-enquiry-primary">Return to map</Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="advertise-form-heading">
                <div><span className="ad-rail-kicker">START A CAMPAIGN</span><h2>Tell us about your placement.</h2></div>
                <span className="advertise-step">1 / 2</span>
              </div>

              <label>Ad format<select value={format} onChange={(event) => setFormat(event.target.value as AdFormat)}><option value="map_rail">Five-slot map rail</option><option value="billboard">3D map billboard</option><option value="aircraft">Aircraft banner</option></select></label>
              <div className="advertise-format-note"><div><strong>{FORMAT_DETAILS[format].label}</strong><span>{FORMAT_DETAILS[format].description}</span></div><b>{FORMAT_PRICES[format].amount}<small>{FORMAT_PRICES[format].duration}</small></b></div>

              <div className="advertise-field-grid">
                <label>Brand name<input name="brand_name" required placeholder="Your brand" /></label>
                <label>Contact person<input name="contact_name" required placeholder="Your name" /></label>
              </div>
              <label>Phone or email<input name="contact" required placeholder="you@example.com or +91..." /></label>
              <div className="advertise-field-grid">
                <label>Banner image URL<input name="image_url" type="url" placeholder="https://..." /></label>
                <label>Destination URL<input name="target_url" type="url" placeholder="https://yourbrand.com" /></label>
              </div>

              {format === "billboard" && <div className="advertise-inline-note">Billboards are placed at an agreed map location after review. Our team will confirm dimensions and orientation with you.</div>}
              {format === "aircraft" && <div className="advertise-inline-note">Aircraft banners move across the map and do not require a pin or fixed location.</div>}

              <div className="advertise-field-grid"><label>Start date<input name="campaign_start" type="date" /></label><label>End date<input name="campaign_end" type="date" /></label></div>
              <label>Campaign notes<textarea name="message" rows={3} placeholder="Tell us what you want people to notice..." /></label>
              <div className="advertise-payment">
                <div className="advertise-payment-heading"><div><span className="ad-rail-kicker">STEP 2 · PAYMENT</span><h3>Pay {FORMAT_PRICES[format].amount} via UPI</h3></div><span className="advertise-payment-badge">UPI</span></div>
                <div className="advertise-payment-body"><div className="advertise-qr-placeholder"><span>QR</span><small>Paste QR here</small></div><div><strong>Replace these details</strong><p>Scan with any UPI app and pay {FORMAT_PRICES[format].amount}.</p><code>your-upi-id@bank</code></div></div>
                <label>Payment proof URL<input name="payment_proof_url" type="url" placeholder="Paste screenshot link (optional for now)" /></label>
              </div>
              <label className="advertise-check"><input type="checkbox" required /> <span>I confirm I&apos;m authorised to advertise this brand and agree to manual review.</span></label>
              {status === "error" && <div className="ad-enquiry-error">{error}</div>}
              <button type="submit" className="ad-enquiry-primary" disabled={status === "sending"}>{status === "sending" ? "Submitting…" : "Submit for review"}</button>
              <small className="advertise-footnote">No payment is collected at this stage. We&apos;ll contact you with availability and pricing.</small>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
