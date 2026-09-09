/**
 * The advertising product, in one place.
 *
 * Two placements, priced by how many people see them:
 *
 *   map   the sponsored slots along the bottom of the map — everyone
 *         browsing sees these, whether or not they open a pandal
 *   card  inside a pandal's detail card — only people who opened that
 *         pandal, so fewer eyes and a lower price
 *
 * Sold in fixed windows rather than open-ended: this is a ten-day festival,
 * and an ad with no end date is one somebody has to remember to take down.
 *
 * Prices live here and nowhere else. They appear on the chooser, in the
 * form, in the payment panel and in the admin inbox, and four copies of a
 * number is three chances to change three of them.
 */
export const AD_PLACEMENTS = {
  map: {
    id: "map",
    label: "Advertise on the map",
    headline: "Put your ad in front of everyone.",
    blurb:
      "Your banner sits in the sponsored slots on the map screen, seen by everyone browsing — before they open a single pandal.",
    priceInr: 500,
    days: 2,
    slots: 5,
    maxImages: 3,
    benefits: [
      {
        title: "Shown on the map",
        body: "Your banner appears in the sponsored slots everyone sees while browsing.",
      },
      {
        title: "Reviewed, not automatic",
        body: "We check your payment and your creative before anything goes live.",
      },
      {
        title: "Keeps the map free",
        body: "Ads are what pay for this, so finding a pandal never costs anyone anything.",
      },
    ],
    imageHint: "Square (1:1) works best — that is the shape of the slot. Upload up to 3 and they rotate.",
  },
  card: {
    id: "card",
    label: "Advertise on pandal cards",
    headline: "Reach people who are already on their way.",
    blurb:
      "Your banner sits inside the pandal detail cards, seen by people who opened one to check the details. Fewer eyes than the map, so it costs less.",
    priceInr: 200,
    days: 2,
    slots: 3,
    maxImages: 1,
    benefits: [
      {
        title: "Shown inside pandal cards",
        body: "It appears to someone reading about a pandal, a moment before they tap Directions.",
      },
      {
        title: "Reviewed, not automatic",
        body: "We check your payment and your creative before anything goes live.",
      },
      {
        title: "Keeps the map free",
        body: "Ads are what pay for this, so finding a pandal never costs anyone anything.",
      },
    ],
    imageHint: "Wide (3:1) works best — the card slot is a banner. One image.",
  },
} as const;

export type AdPlacementId = keyof typeof AD_PLACEMENTS;
export const AD_PLACEMENT_IDS = Object.keys(AD_PLACEMENTS) as AdPlacementId[];

export function isAdPlacement(value: unknown): value is AdPlacementId {
  return typeof value === "string" && value in AD_PLACEMENTS;
}

/**
 * Where the money goes. Replace both before taking a single payment —
 * they ship as obvious placeholders rather than plausible-looking fakes
 * precisely so an unfinished setup cannot quietly accept a transfer into
 * nowhere.
 */
export const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID ?? "";
export const UPI_PAYEE_NAME = process.env.NEXT_PUBLIC_UPI_PAYEE ?? "WhatsNearYou";

/**
 * A UPI deep link. On a phone this opens GPay/PhonePe/Paytm directly with
 * the amount already filled, which is the difference between "pay us" and
 * "pay us, and here is exactly how".
 */
export function upiLink(amountInr: number, note: string): string | null {
  if (!UPI_ID) return null;
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_PAYEE_NAME,
    am: String(amountInr),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}
