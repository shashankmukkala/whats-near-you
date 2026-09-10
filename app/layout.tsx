import type { Metadata } from "next";
import { Inter, Instrument_Serif, Noto_Serif_Telugu, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Two faces doing two jobs. Inter runs the interface, where a serif would
// cost legibility at 13px for nothing. Instrument Serif runs the
// headlines, where one well-set serif is the cheapest premium signal there
// is — and it puts real distance between this and the Geist-everywhere
// site this design used to resemble.
//
// Instrument Serif ships one weight on purpose: size and tracking do the
// work instead of boldness, which is why it looks composed rather than
// shouted.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

// Telugu, not Devanagari. This is Hyderabad — Telugu is what is on the
// shopfronts, the bus boards and the pandal banners themselves. Reaching
// for Hindi would be the outsider default, and the whole point of setting
// a headline in script is that it belongs to the place.
const telugu = Noto_Serif_Telugu({
  variable: "--font-telugu",
  subsets: ["telugu"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const FALLBACK_SITE_URL = "http://localhost:3000";

/**
 * Resolves NEXT_PUBLIC_SITE_URL into a real URL, tolerantly.
 *
 * This value is typed by a human into a hosting dashboard, and the
 * overwhelmingly common slip is pasting the bare domain that the
 * dashboard displays — "whats-near-u.vercel.app" — without a scheme.
 * `new URL()` throws on that, and because this runs at module scope in
 * the root layout, the throw took down the entire production build with
 * `Failed to collect configuration for /_not-found`, an error naming a
 * route that has nothing to do with the cause. That is a genuinely awful
 * way to spend twenty minutes.
 *
 * A missing scheme is an unambiguous typo with exactly one sensible
 * repair, so it gets repaired. Anything still unparseable falls back to
 * localhost: link previews degrade, which is bad, but the site deploys,
 * which is the difference between a bad preview and no site at all.
 */
function resolveSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return new URL(FALLBACK_SITE_URL);

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export const metadata: Metadata = {
  // Link crawlers refuse relative image URLs, so every og:image has to
  // resolve to an absolute one. Next builds that from metadataBase — set
  // NEXT_PUBLIC_SITE_URL in production, or previews point at the deploy's
  // own localhost and unfurl with no image at all.
  metadataBase: resolveSiteUrl(),
  title: "WhatsNearYou",
  description: "A live map of Hyderabad's Ganesh pandals — what's near you, and what's on now.",
};

// Light is the only theme — no toggle, no stored preference, no dark CSS
// to keep in sync. The `dark` class that used to sit here is deliberately
// gone: it is what switched on every `dark:` Tailwind variant in the tree,
// so removing it flips the whole component library to its light branch in
// one move. The warm palette itself lives in globals.css under WARM LIGHT
// THEME.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("antialiased", geistMono.variable, "font-sans", sans.variable, display.variable, telugu.variable)}>
      {/* No h-full on either element, and this matters more than it looks.
          `height: 100%` pins the document to exactly the viewport, so a
          page taller than one screen renders its overflow but the window
          has nothing to scroll: the landing page showed its hero and
          nothing else, with the rest present in the DOM and unreachable.
          Measured as documentElement.scrollHeight 900 against
          body.scrollHeight 1745.

          It was inherited from a build where every route was the map. The
          map still does not need it — map-experience-shell carries its own
          h-dvh and overflow-hidden — so nothing is lost by letting the
          document size to its content the way a document should. */}
      <body>
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
