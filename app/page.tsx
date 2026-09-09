import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isCurrent, isLiveNow, SEASON_ENDS_AT, SEASON_STARTS_AT } from "@/lib/season";
import type { Place } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "WhatsNearYou",
  description: "Find the Ganesh pandals near you across Hyderabad — what's on now, and how long you have left to see it.",
};

const IST = "Asia/Kolkata";
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: IST });

/**
 * Counts shown in the hero, read live rather than hardcoded.
 *
 * A landing page that claims "15 pandals" in a string is wrong the moment
 * the sixteenth is added, and nobody remembers to update it. Reading the
 * real numbers also means the page is honest on the day the festival ends,
 * when "live now" legitimately becomes zero.
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Links shared before the map moved to /map pointed at "/?place=<id>".
  // Those are out in the world already — forwarded, pasted into chats — so
  // they redirect rather than landing people on a page that ignores them.
  // A crawler follows this too, and picks up the pandal's own preview card
  // from /map.
  const params = await searchParams;
  const place = typeof params.place === "string" ? params.place : null;
  if (place) redirect(`/map?place=${encodeURIComponent(place)}`);

  const stats = await getStats();

  return (
    <main className="min-h-dvh bg-[var(--cream-100)]">
      <SiteHeader />

      {/* ---- Hero ---------------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Two soft blooms rather than a flat wash. They sit behind the
            content on the base layer's own background, so nothing needs a
            negative z-index and there is no stacking context to get wrong. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 0%, rgba(244,169,60,0.34), transparent 45%), radial-gradient(circle at 90% 12%, rgba(232,84,63,0.20), transparent 42%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          {/* The cutout, not the original. The artwork ships on a flat
              #fdf9ef ground, a shade lighter than the page, which left a
              pale square around it. mix-blend-multiply was tried first and
              is worse: it converts that into a DARKER square wherever the
              hero gradient sits behind it. scripts/cutout-hero.mjs makes
              the ground genuinely transparent as a one-off build step,
              with an alpha ramp across the anti-aliased edge so the
              linework stays smooth against any colour behind it.

              next/image rather than a plain img: the source is a 1.3MB PNG
              and the largest thing on the page, so it is also the LCP
              element. Next serves it resized as WebP/AVIF, and the
              priority flag stops it queueing behind everything else. */}
          <div className="order-first mx-auto w-full max-w-sm lg:order-last lg:max-w-none">
            <Image
              src="/ganesha-cutout.png"
              alt="An illustration of Ganesha with a child offering prayers"
              width={1254}
              height={1254}
              priority
              sizes="(max-width: 1023px) 22rem, 40vw"
              className="h-auto w-full"
            />
          </div>

          <div className="text-center lg:text-left">
          <span className="section-eyebrow">Ganesh Chaturthi {new Date(SEASON_STARTS_AT).getFullYear()}</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--ink)] sm:text-6xl">
            Every pandal in the city, on one map.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-muted)] sm:text-lg lg:mx-0">
            Find the Ganesh pandals near you, see which ones are open right now, and get directions
            straight there. {dateLabel(SEASON_STARTS_AT)} to {dateLabel(SEASON_ENDS_AT)}.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href="/map" className="btn-primary">
              See the map
            </Link>
            <Link href="/submit" className="btn-secondary">
              Add a pandal
            </Link>
          </div>

          {/* Real numbers, read from the database on every request. */}
          <dl className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3 lg:mx-0">
            {[
              { value: stats.total, label: stats.total === 1 ? "pandal" : "pandals" },
              { value: stats.areas, label: stats.areas === 1 ? "area" : "areas" },
              { value: stats.live, label: "open now" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[1.25rem] border border-[var(--ink-line)] bg-[#ffffffb3] px-3 py-4">
                <dt className="text-2xl font-extrabold tracking-tight text-[var(--accent-deep)] sm:text-3xl">
                  {stat.value}
                </dt>
                <dd className="mt-0.5 text-xs font-semibold text-[var(--ink-muted)]">{stat.label}</dd>
              </div>
            ))}
          </dl>
          </div>
        </div>
      </section>

      {/* ---- What this is -------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
        <div className="card-elevated overflow-hidden p-7 sm:p-10">
          <span className="section-eyebrow">Ten days, one neighbourhood at a time</span>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
            The pandal down the road, and the one worth the trip across town.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--ink-muted)] sm:text-base">
            Every year the city fills with pandals — some a few streets long in the making, some drawing
            crowds from every corner of Hyderabad. They go up, they stand for a few days, and then they
            are gone until next year. This map is where to find them while they are here.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Search by area",
                body: "Ram Nagar, Khairatabad, Balapur, Secunderabad — jump straight to the neighbourhood you are in.",
              },
              {
                title: "See what is open now",
                body: "Every pandal carries its own dates, so you always know what is standing today and how long is left.",
              },
              {
                title: "Get directions",
                body: "One tap to Google Maps, using the pandal's own location rather than a guessed pin.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.25rem] border border-[var(--ink-line)] bg-[#ffffff80] p-5">
                <h3 className="text-sm font-bold text-[var(--ink)]">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Contribute ---------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="card-elevated p-7 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <span className="section-eyebrow">Know one we are missing?</span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
                Add your neighbourhood&apos;s pandal.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)] sm:text-base">
                Drop a pin, add a photo and a contact number. We check every submission before it goes
                live, so the map stays worth trusting. It takes about a minute and costs nothing.
              </p>
            </div>
            <Link href="/submit" className="btn-primary self-start sm:self-auto">
              Add a pandal
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Footer -------------------------------------------------- */}
      <footer className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
        <span className="brand-mark mx-auto flex h-10 w-10 items-center justify-center rounded-xl">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </span>
        <p className="mt-4 text-lg font-bold tracking-tight text-[var(--ink)]">He brings us together.</p>
        <p className="mt-2 text-xs text-[var(--ink-muted)]">Made with ♥ for Hyderabad</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
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
      </footer>
    </main>
  );
}
