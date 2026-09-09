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

export const metadata: Metadata = {
  // Link crawlers refuse relative image URLs, so every og:image has to
  // resolve to an absolute one. Next builds that from metadataBase — set
  // NEXT_PUBLIC_SITE_URL in production or previews will point at the
  // deploy's own localhost and unfurl with no image at all.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
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
