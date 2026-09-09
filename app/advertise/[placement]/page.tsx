import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import AdvertiseForm from "@/components/AdvertiseForm";
import { AD_PLACEMENTS, AD_PLACEMENT_IDS, isAdPlacement } from "@/lib/adPlacements";

export function generateStaticParams() {
  return AD_PLACEMENT_IDS.map((placement) => ({ placement }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ placement: string }>;
}): Promise<Metadata> {
  const { placement } = await params;
  if (!isAdPlacement(placement)) return { title: "Advertise · WhatsNearYou" };
  return {
    title: `${AD_PLACEMENTS[placement].label} · WhatsNearYou`,
    description: AD_PLACEMENTS[placement].blurb,
  };
}

const BENEFIT_ICONS = [
  <path key="a" d="M4 6h16v12H4zM8 18l1.5-4M16 18l-1.5-4" />,
  <path key="b" d="M9 12.5l2 2 4.5-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  <path key="c" d="M12 20s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9z" />,
];

export default async function AdvertisePlacementPage({
  params,
}: {
  params: Promise<{ placement: string }>;
}) {
  const { placement: raw } = await params;
  if (!isAdPlacement(raw)) notFound();
  const placement = AD_PLACEMENTS[raw];

  return (
    <main className="min-h-dvh bg-[var(--cream-100)]">
      <SiteHeader active="advertise" />

      {/* Two columns: what you are buying on the left, the form on the
          right. The pitch stays on screen while the form is filled, so the
          price is never something you have to scroll back to check. It
          stacks on a phone with the pitch first, for the same reason. */}
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:py-14">
        <div>
          <span className="section-eyebrow">{placement.label}</span>
          <h1 className="mt-3 text-[2rem] leading-tight font-extrabold tracking-tight text-[var(--ink)] sm:text-[2.6rem]">
            {placement.headline}
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--ink-muted)]">{placement.blurb}</p>

          <div className="mt-8 space-y-5">
            {placement.benefits.map((benefit, i) => (
              <div key={benefit.title} className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.8rem] bg-[var(--accent-wash)] text-[var(--accent-deep)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    {BENEFIT_ICONS[i]}
                  </svg>
                </span>
                <div>
                  <h2 className="text-[14.5px] font-bold text-[var(--ink)]">{benefit.title}</h2>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-[var(--ink-muted)]">{benefit.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.25rem] border border-[var(--accent-tint)] bg-[var(--accent-wash)] p-5">
            <p className="text-sm font-bold text-[var(--accent-deep)]">
              ₹{placement.priceInr}, valid for {placement.days} days from approval
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
              Fill in the details, pay by UPI, then upload the payment screenshot. We check it before your ad goes up.
            </p>
            <p className="mt-2 text-[11.5px] text-[var(--ink-soft)]">
              If we cannot verify it, you are refunded in full.
            </p>
          </div>
        </div>

        <AdvertiseForm placement={raw} />
      </div>
    </main>
  );
}
