import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Plus Jakarta Sans reads more distinctive/premium than a system-ish
// default at UI sizes (rounded terminals, tighter numerals) — used for
// every weight in the app now, not just headings.
const sans = Plus_Jakarta_Sans({
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

// Dark is the only theme now — no toggle, no stored preference, no
// light-mode CSS to keep in sync. Applied here directly (not via a
// client-side hook adding a class after hydration) so there's no
// flash-of-light-theme on first paint.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "dark", geistMono.variable, "font-sans", sans.variable)}
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
