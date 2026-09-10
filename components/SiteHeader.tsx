import Image from "next/image";
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
          {/* The real mark, not the placeholder pin glyph. No coloured
              tile behind it: the logo is its own shape, and a saffron
              rounded square around dark linework reads as two logos. */}
          <Image src="/logo.png" alt="" width={512} height={512} priority className="h-9 w-9 shrink-0" />
          <span className="text-[15px] font-bold tracking-tight text-[var(--ink)]">WhatsNearYou</span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/advertise" className={active === "advertise" ? "btn-secondary" : "btn-ghost"}>
            Publish ads
          </Link>
          <span className={active === "submit" ? "contents" : "hidden sm:contents"}>
            <Link href="/submit" className={active === "submit" ? "btn-secondary" : "btn-ghost"}>
              Add a pandal
            </Link>
          </span>
          <Link href="/map" className="btn-primary">
            View map
          </Link>
        </nav>
      </div>
    </header>
  );
}
