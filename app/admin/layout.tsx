import type { Metadata } from "next";

/**
 * A server layout wrapping every /admin route, for one reason: the admin
 * pages are client components, and a client component cannot export
 * metadata. This can, and it applies to all of them.
 *
 * noindex, nofollow, and explicitly no archive or snippet. A sign-in form
 * has nothing to offer a search result, and a cached copy of one in
 * somebody's index is a small, permanent liability — it is the shape
 * phishing classifiers are trained on, and the fewer places it appears
 * outside this domain the better.
 */
export const metadata: Metadata = {
  title: "Admin · WhatsNearYou",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
