import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { AD_PLACEMENTS, AD_PLACEMENT_IDS } from "@/lib/adPlacements";

export const metadata: Metadata = {
  title: "Advertise · WhatsNearYou",
  description: "Put your brand on Hyderabad's Ganesh pandal map.",
};

/**
 * The chooser. Deliberately its own page rather than a dropdown inside the
 * form: the placement decides the price, the image shape and who sees it,
 * so it is the actual decision being made. Burying it in a select would
 * make the most consequential choice the least visible one.
 */
export default function AdvertisePage() {
  return (
    <main className="min-h-dvh bg-[var(--cream-100)]">
      <SiteHeader active="advertise" />

      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
        <span className="section-eyebrow">Advertise</span>
        <h1 className="mt-3 text-[2rem] leading-tight font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl">
          Where should your ad show up?
        </h1>
        <p className="mt-3 text-[15px] text-[var(--ink-muted)]">
          Every placement is sold in {AD_PLACEMENTS.map.days}-day windows, and reviewed before it goes live.
        </p>

        <div className="mt-8 grid gap-4">
          {AD_PLACEMENT_IDS.map((id) => {
            const placement = AD_PLACEMENTS[id];
            return (
              <div key={id} className="card-elevated p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">{placement.label}</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">{placement.blurb}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold tracking-tight text-[var(--accent-deep)]">
                      ₹{placement.priceInr}
                    </div>
                    <div className="text-xs font-semibold text-[var(--ink-soft)]">
                      {placement.days} days · {placement.slots} slots
                    </div>
                  </div>
                </div>
                <Link href={`/advertise/${id}`} className="btn-primary mt-5">
                  Advertise here
                </Link>
              </div>
            );
          })}
        </div>

        <ul className="mt-8 space-y-1.5 text-center text-xs text-[var(--ink-soft)]">
          <li>Every ad is checked by a person before it goes live.</li>
          <li>Ads are what keep the map free for everyone.</li>
        </ul>
      </div>
    </main>
  );
}
