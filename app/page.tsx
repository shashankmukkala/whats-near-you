import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isCurrent, isLiveNow, SEASON_ENDS_AT, SEASON_STARTS_AT } from "@/lib/season";
import type { Place } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "WhatsNearYou",
  description: "Every Ganesh pandal in Hyderabad, on one map.",
};

const IST = "Asia/Kolkata";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", timeZone: IST });
const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: IST });

/**
 * Counts for the hero, read live rather than written into the copy.
 * "15 pandals" in a string is wrong the moment the sixteenth is added, and
 * nobody remembers to change it.
 */
async function getStats() {
  if (!isSupabaseConfigured()) return { total: 0, areas: 0, live: 0 };
  const { data } = await supabase
    .from("places")
    .select("area,starts_at,ends_at,archived_at")
    .is("archived_at", null);

  const places = (data ?? []) as unknown as Place[];
  const current = places.filter((p) => isCurrent(p));
  return {
    total: current.length,
    areas: new Set(current.map((p) => p.area).filter(Boolean)).size,
    live: current.filter((p) => isLiveNow(p)).length,
  };
}

/**
 * Line icons, not emoji. Emoji render as a different picture on every
 * platform and drag their own colours into a palette that is doing careful
 * work — a yellow 🕐 next to saffron looks like a mistake on Android and
 * fine on iOS, and there is no way to fix it.
 */
const ICONS = {
  area: <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  clock: <path d="M12 7.5V12l3 1.8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  route: <path d="M5 19 19 5M13 5h6v6" />,
} as const;

function Feature({ icon, title, body }: { icon: keyof typeof ICONS; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[var(--accent-wash)] text-[var(--accent-deep)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          {ICONS[icon]}
        </svg>
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold text-[var(--ink)]">{title}</h3>
        <p className="mt-1 text-[13.5px] leading-snug text-[var(--ink-muted)]">{body}</p>
      </div>
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Links shared before the map moved to /map are already out in the world,
  // forwarded and pasted into chats. A crawler follows this too, so those
  // links keep their own preview card.
  const params = await searchParams;
  const place = typeof params.place === "string" ? params.place : null;
  if (place) redirect(`/map?place=${encodeURIComponent(place)}`);

  const stats = await getStats();
  const dates = `${day(SEASON_STARTS_AT)}–${dayMonth(SEASON_ENDS_AT)}`;

  return (
    <main className="bg-[var(--cream-100)]">
      <SiteHeader />

      {/* ---- Hero ------------------------------------------------------ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% 0%, rgba(244,169,60,0.30), transparent 46%), radial-gradient(circle at 92% 10%, rgba(232,84,63,0.16), transparent 44%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-5 pt-10 pb-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 lg:pt-14 lg:pb-10">
          {/* Cut out by scripts/cutout-hero.mjs. Empty alt on purpose — it
              is decoration, and the headline beside it already says what
              the page is; a screen reader announcing the artwork would
              just be noise before the actual content. */}
          <div className="order-first mx-auto w-full max-w-[17rem] lg:order-last lg:max-w-[24rem]">
            <Image
              src="/ganesha-cutout.png"
              alt=""
              width={1254}
              height={1254}
              priority
              sizes="(max-width: 1023px) 17rem, 24rem"
              className="h-auto w-full"
            />
          </div>

          <div className="text-center lg:text-left">
            <span className="section-eyebrow">{dates}</span>
            <h1 className="mt-3 text-[2.15rem] leading-[1.05] font-extrabold tracking-tight text-[var(--ink)] sm:text-[3.4rem]">
              Every pandal in the city, on one map.
            </h1>
            <p className="mt-4 text-[17px] text-[var(--ink-muted)]">
              See what&apos;s near you, and what&apos;s open tonight.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-2.5 lg:justify-start">
              <Link href="/map" className="btn-primary">
                See the map
              </Link>
              <Link href="/submit" className="btn-secondary">
                Add a pandal
              </Link>
            </div>

            {/* Bare numbers rather than three bordered boxes. The boxes gave
                equal visual weight to a stat row and the primary action
                sitting right above it. */}
            <dl className="mt-9 flex justify-center gap-8 lg:justify-start">
              {[
                { value: stats.total, label: "pandals" },
                { value: stats.areas, label: "areas" },
                { value: stats.live, label: "open now" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-2xl font-extrabold tracking-tight text-[var(--accent-deep)]">{stat.value}</dt>
                  <dd className="mt-0.5 text-xs font-semibold text-[var(--ink-soft)]">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---- What it does ---------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="card-elevated grid gap-7 p-7 sm:grid-cols-3 sm:p-8">
          <Feature icon="area" title="By area" body="Ram Nagar to Balapur." />
          <Feature icon="clock" title="Open now" body="Real dates on every pandal." />
          <Feature icon="route" title="Directions" body="One tap to Google Maps." />
        </div>
      </section>

      {/* ---- Contribute ------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-5 py-4 sm:px-6">
        <div className="card-elevated flex flex-col items-center gap-5 p-8 text-center sm:flex-row sm:justify-between sm:p-9 sm:text-left">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
              Know one we&apos;re missing?
            </h2>
            <p className="mt-1.5 text-sm text-[var(--ink-muted)]">Takes a minute. We check every one.</p>
          </div>
          <Link href="/submit" className="btn-primary shrink-0">
            Add a pandal
          </Link>
        </div>
      </section>

      {/* ---- Footer ---------------------------------------------------- */}
      <footer className="mx-auto max-w-6xl px-5 py-14 text-center sm:px-6">
        <p className="text-xl font-bold tracking-tight text-[var(--ink)]">He brings us together.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1">
          <Link href="/map" className="btn-ghost">
            Map
          </Link>
          <Link href="/submit" className="btn-ghost">
            Add a pandal
          </Link>
          <Link href="/advertise" className="btn-ghost">
            Publish ads
          </Link>
        </div>
        <p className="mt-5 text-xs text-[var(--ink-soft)]">Made for Hyderabad</p>
      </footer>
    </main>
  );
}
