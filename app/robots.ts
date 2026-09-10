import type { MetadataRoute } from "next";

/**
 * There was no robots.txt at all, which meant the admin sign-in was as
 * crawlable as the map.
 *
 * That matters more than the usual SEO tidiness argument. A username and
 * password form sitting on a public, indexable URL on a shared hosting
 * subdomain is the exact shape of a phishing page, and it is what
 * automated classifiers look at. Keeping it out of indexes will not by
 * itself change a browser's mind, but leaving it in makes the page easier
 * to find, easier to sample, and easier to mistake for one.
 *
 * The API is disallowed for a plainer reason: those routes are for the
 * app, and a crawler walking /api/og for every pandal is load with no
 * upside.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/api/"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}),
  };
}
