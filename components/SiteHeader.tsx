import Link from "next/link";

/**
 * The header for every page that is not the map.
 *
 * The map deliberately has no header — it is a full-bleed canvas with
 * floating controls, and a bar across the top would eat the one thing that
 * page is for. Everything else (landing, submit, advertise) gets this.
 */
export default function SiteHeader({ active }: { active?: "map" | "submit" | "advertise" }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--ink-line)] bg-[#fffdf8cc] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
              <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <span className="text-[15px] font-bold tracking-tight text-[var(--ink)]">WhatsNearYou</span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/advertise" className={active === "advertise" ? "btn-secondary" : "btn-ghost"}>
            Publish ads
          </Link>
          <Link href="/submit" className={active === "submit" ? "btn-secondary" : "btn-ghost hidden sm:inline-flex"}>
            Add a pandal
          </Link>
          <Link href="/map" className="btn-primary">
            View map
          </Link>
        </nav>
      </div>
    </header>
  );
}
