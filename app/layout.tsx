import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Geist. Its numerals and tighter apertures hold up at the small sizes
// this UI leans on, and 800 is needed for the landing headlines.
const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistMono.variable, "font-sans", sans.variable)}
    >
      {/* Not overflow-hidden here — that would block normal page scroll
          on every non-map route (/advertise, /admin/ad-enquiries). The
          map experience contains its own scroll via
          map-experience-shell's h-dvh + overflow-hidden, so the body does
          not need to clip as well. */}
      <body className="h-full">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
