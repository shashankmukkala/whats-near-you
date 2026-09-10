import Image from "next/image";
import Link from "next/link";

/**
 * The cover.
 *
 * Every other surface in this product is a tool and is built like one:
 * ivory, hairlines, tight corners, nothing decorative. This page is not a
 * tool. Its whole job is to say what this is and send you to the map, and
 * a page with one job can afford to be a poster.
 *
 * Treating it as a cover rather than a second theme is the important part.
 * It shares no components with the rest of the site, so there is nothing
 * here to keep in sync — which is the failure mode of running two visual
 * systems, and one this project has already paid for once.
 *
 * The composition is layered rather than illustrated, because layering is
 * something that can be built honestly and an illustrated street scene is
 * not:
 *
 *   1. a night ground, deep vermilion into near-black
 *   2. lamplight — two brass glows, low and warm
 *   3. the word itself, set enormous in Telugu and mostly transparent, so
 *      it reads as painted signage rather than as a heading
 *   4. the figure
 *   5. film grain over everything
 *
 * The grain is what does the most work for the least code. A flat gradient
 * reads as a CSS background; the same gradient under noise reads as a
 * printed surface. It is one SVG turbulence filter and it is the single
 * biggest difference between "a dark hero" and something that looks made.
 */
export default function HeroPoster({
  dates,
  stats,
}: {
  dates: string;
  stats: { total: number; areas: number; live: number };
}) {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#140607] text-[#f4ece2]">
      {/* 1 — night ground */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-30"
        style={{
          backgroundImage:
            "radial-gradient(120% 80% at 50% 110%, #5c1512 0%, #2a0b0c 45%, #140607 78%)",
        }}
      />

      {/* 2 — lamplight. Two sources, different sizes, neither centred, so
             the light reads as coming from somewhere rather than being
             applied evenly. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(38% 30% at 16% 22%, rgba(201,155,69,0.30), transparent 70%), radial-gradient(46% 34% at 88% 68%, rgba(193,54,47,0.28), transparent 72%)",
        }}
      />

      {/* 3 — the word, as signage. Huge, clipped by the frame, and low
             enough in opacity that it is texture rather than text. The
             English headline below is what actually gets read; this is
             what the page feels like. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[16%] -z-10 flex justify-center overflow-hidden select-none sm:top-[12%]"
      >
        <span
          className="font-telugu leading-none whitespace-nowrap"
          style={{
            fontSize: "clamp(9rem, 30vw, 28rem)",
            color: "#f4ece2",
            opacity: 0.09,
            letterSpacing: "-0.04em",
          }}
        >
          గణేశ
        </span>
      </div>

      {/* 5 — grain, over everything. feTurbulence rather than a texture
             file: it is a few hundred bytes, scales to any screen, and
             never loads late. mix-blend-overlay keeps it as surface noise
             instead of a grey veil. */}
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 h-full w-full opacity-[0.16] mix-blend-overlay">
        <filter id="poster-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#poster-grain)" />
      </svg>

      {/* ---- chrome: as little as the page can get away with ---------- */}
      <header className="relative z-30 flex items-center justify-between px-5 py-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <Image src="/logo-mark.png" alt="" width={256} height={256} className="h-8 w-8" priority />
          <span className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#f4ece2b3]">WhatsNearYou</span>
        </span>
        <span className="text-[13px] tracking-[0.14em] uppercase text-[#f4ece2b3]">{dates}</span>
      </header>

      {/* ---- the composition ------------------------------------------ */}
      {/* justify-center, not justify-end with an mb-auto on the figure.
          That pushed the figure to the top and left a dead band across the
          middle of every phone — the composition has to hold together as
          one block, not float apart to fill the viewport. */}
      <div className="relative z-30 flex flex-1 flex-col items-center justify-center px-5 py-8 text-center sm:px-8 sm:py-10">
        {/* 4 — the figure. Sits on the ground line the composition builds
               to, and is allowed to be large: it is the subject. */}
        <Image
          src="/ganesha-cutout.png"
          alt=""
          width={1254}
          height={1254}
          priority
          sizes="(max-width: 640px) 78vw, 34rem"
          className="mb-2 w-[64vw] max-w-[30rem] drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)] sm:mb-4"
        />

        <h1
          className="max-w-3xl text-[2.3rem] leading-[1.04] tracking-[-0.02em] sm:text-[3.6rem]"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          Every pandal in the city, on one map.
        </h1>

        <p className="mt-4 text-[15px] text-[#f4ece2b3] sm:text-[17px]">
          See what&apos;s near you, and what&apos;s open tonight.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/map"
            className="rounded-[6px] bg-[#f4ece2] px-6 py-3 text-[15px] font-semibold text-[#140607] transition-colors hover:bg-white"
          >
            See the map
          </Link>
          <Link
            href="/submit"
            className="rounded-[6px] border border-[#f4ece23d] px-6 py-3 text-[15px] font-semibold text-[#f4ece2] transition-colors hover:border-[#f4ece2] hover:bg-[#f4ece214]"
          >
            Add a pandal
          </Link>
        </div>

        {/* Read live, not written into the copy — the same numbers the map
            is showing, so the cover cannot quietly go stale. */}
        <dl className="mt-10 flex items-center justify-center gap-7 text-[#f4ece2]">
          {[
            { value: stats.total, label: "pandals" },
            { value: stats.areas, label: "areas" },
            { value: stats.live, label: "open now" },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="text-xl font-semibold tracking-tight sm:text-2xl">{stat.value}</dt>
              <dd className="mt-0.5 text-[11px] tracking-[0.12em] uppercase text-[#f4ece285]">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
