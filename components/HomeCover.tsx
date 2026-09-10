import Image from "next/image";
import Link from "next/link";

/**
 * The cover. One screen, no scroll, the painting and three ways in.
 *
 * Every other surface in this product is a tool and is built like one:
 * ivory, hairlines, tight corners, nothing decorative. This page is not a
 * tool. Its whole job is to say what this is and send you somewhere, and a
 * page with one job can be a picture with the words placed on it.
 *
 * The picture is doing all the work, so the interface's job here is to
 * stay out of its way while still being unmistakably clickable — which is
 * the whole difficulty. Three decisions carry it:
 *
 * TYPOGRAPHY BORROWED FROM THE PAINTING. The painted banners in the source
 * art set their words in cream capitals, letterspaced, with a short rule
 * underneath. The navigation uses that same device, so it reads as
 * belonging to the scene rather than sitting on top of it. The rule is
 * also what makes it work as an interface: it is short at rest and runs
 * the full width of the label on hover, so the affordance is motion rather
 * than a box.
 *
 * SCRIMS, NOT PANELS. Type over illustration needs a floor under it, but a
 * card would put a rectangle in the middle of a painting. Two soft
 * gradients — one down the right edge, one along the bottom — darken
 * exactly where the words go and nowhere else.
 *
 * GRAIN OVER EVERYTHING. The art is upscaled (see scripts/build-home-art),
 * and grain is what stops that reading as softness: an SVG turbulence
 * filter is resolution-independent, so the surface texture stays crisp at
 * any density even where the picture beneath it is not.
 */

const NAV = [
  { href: "/map", label: "View map", primary: true },
  { href: "/submit", label: "List a pandal", primary: false },
  { href: "/advertise", label: "Publish ads", primary: false },
] as const;

export default function HomeCover({ dates, total }: { dates: string; total: number }) {
  return (
    <section className="cover-screen relative isolate h-[100svh] overflow-hidden bg-[#120a08] text-[#f6ece0]">
      {/* ---- the painting --------------------------------------------- */}
      {/* A <picture>, not next/image, because this is art direction: the
          landscape and portrait files are different crops of the same
          painting, not two sizes of one image. next/image would preload
          both and show one. The files are pre-encoded WebP at the sizes
          they are used, so there is nothing left for the optimiser to do. */}
      <picture>
        <source media="(min-width: 640px)" srcSet="/home-wide.webp" />
        <img
          src="/home-tall.webp"
          alt="A Hyderabad street at dusk during Ganesh Utsav — a lit pandal, marigold stalls and crowds, with the Charminar behind."
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      </picture>

      {/* ---- scrims ---------------------------------------------------- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            // top, for the mark; bottom, for the line; right, for the nav.
            "linear-gradient(to bottom, rgba(18,10,8,0.62) 0%, transparent 22%)," +
            "linear-gradient(to top, rgba(18,10,8,0.86) 0%, rgba(18,10,8,0.45) 26%, transparent 52%)," +
            "linear-gradient(to left, rgba(18,10,8,0.62) 0%, transparent 46%)",
        }}
      />

      {/* ---- grain ----------------------------------------------------- */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full opacity-[0.14] mix-blend-overlay"
      >
        <filter id="cover-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cover-grain)" />
      </svg>

      {/* ---- the words ------------------------------------------------- */}
      <div className="relative z-30 flex h-full flex-col px-5 py-5 sm:px-9 sm:py-7">
        <header className="flex items-center gap-2.5">
          <Image src="/logo-mark.png" alt="" width={256} height={256} className="h-8 w-8" priority />
          <span className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#f6ece0d9]">
            WhatsNearYou
          </span>
        </header>

        {/* Bottom-aligned on a phone so the navigation sits just above the
            line and both live in the same dark band over the crowd;
            centred on a wide screen, where the right edge is a column of
            its own. */}
        <div className="flex flex-1 items-end justify-end sm:items-center">
          {/* The gap is 0/8px and the padding is 10px rather than the
              other way round. Same rhythm on screen, but each link is a
              44px-plus target with no dead strip between them — at 12px
              letterspaced caps the words themselves are only 18px tall,
              which is a thumb-sized miss on a phone. */}
          <nav className="flex flex-col items-end gap-0 sm:gap-2">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="cover-link group py-2.5 text-right">
                <span
                  className={
                    item.primary
                      ? "block text-[15px] font-semibold tracking-[0.2em] uppercase sm:text-[19px]"
                      : "block text-[12px] font-medium tracking-[0.2em] uppercase text-[#f6ece0d6] transition-colors group-hover:text-[#f6ece0] sm:text-[14px]"
                  }
                >
                  {item.label}
                </span>
                {/* The painting's own device: a short dash under a line of
                    signage. Here it is also the hover state — it runs out
                    to the full width of the label, right to left. */}
                <span
                  aria-hidden="true"
                  className={
                    "mt-2 ml-auto block h-px origin-right transition-transform duration-300 ease-out group-hover:scale-x-100 " +
                    (item.primary
                      ? "w-full scale-x-100 bg-[var(--lamp)]"
                      : "w-full scale-x-[0.28] bg-[#f6ece08c]")
                  }
                />
              </Link>
            ))}
          </nav>
        </div>

        <footer className="max-w-[22rem] pt-8 sm:max-w-none sm:pt-0">
          <p
            className="text-[1.45rem] leading-[1.15] sm:text-[2rem]"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            Every pandal in the city, on one map.
          </p>
          {/* The count is read live rather than written into the copy —
              "16 pandals" in a string is wrong the moment a seventeenth is
              added, and nobody remembers to change it. */}
          <p className="mt-2 text-[11px] tracking-[0.16em] uppercase text-[#f6ece0a3] sm:text-[12px]">
            {total > 0 ? `${total} pandals · ` : ""}
            {dates} · Hyderabad
          </p>
        </footer>
      </div>
    </section>
  );
}
