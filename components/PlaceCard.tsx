"use client";

import { useState } from "react";
import type { AdminPlace, Billboard, Place } from "@/lib/supabase";
import { isLiveNow, seasonLabel } from "@/lib/season";
import EditPandalDetails from "@/components/EditPandalDetails";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { useSwipeToDismiss } from "@/lib/useSwipeToDismiss";

/** Tags stop informing and start crowding past three. */
const TAG_DISPLAY_LIMIT = 3;

/**
 * The research sheet's "Known for" runs to ~400 characters — it is real
 * editorial writing about why a pandal matters, not a one-line note, and
 * four paragraphs of it would push the actions below the fold on a phone.
 * Anything longer than this gets clamped with an expand.
 *
 * (The card this is adapted from had no clamp at all, correctly: its
 * equivalent field maxed out at 89 characters, so an expand control could
 * never appear. Different data, different rule.)
 */
const KNOWN_FOR_CLAMP_CHARS = 190;

/**
 * Shows a link as its destination rather than as the name of the field it
 * was stored in. "https://www.instagram.com/khairatabad_ganesh_/" reads
 * as "instagram.com/khairatabad_ganesh_" — enough to know where the tap
 * goes.
 */
function prettyLink(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
  }
}

type PlaceCardProps =
  | {
      kind: "place";
      item: Place;
      onClose: () => void;
      isAdmin?: boolean;
      /** Admin console's own session token — see EditPandalDetails. */
      adminAccessToken?: string | null;
      onPlaceUpdated?: (place: AdminPlace) => void;
    }
  | { kind: "billboard"; item: Billboard; onClose: () => void; isAdmin?: boolean };

export default function PlaceCard(props: PlaceCardProps) {
  const { kind, item, onClose, isAdmin = false } = props;
  const isPlace = kind === "place";
  const place = isPlace ? (item as Place) : null;
  const billboard = !isPlace ? (item as Billboard) : null;

  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // A broken image URL used to be hidden by writing display:none onto the
  // node from an onError handler, which left an empty banner slot in the
  // layout. Tracking it as state removes the element instead.
  const [imageFailed, setImageFailed] = useState(false);

  // Drag-to-dismiss is a phone gesture; on desktop this is a column panel
  // with a pointer and a close button, and binding touch listeners there
  // would be dead weight.
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const sheetRef = useSwipeToDismiss<HTMLDivElement>(onClose, isMobile);

  const live = place ? isLiveNow(place) : false;
  const timing = place ? seasonLabel(place) : null;

  // Prefer Google's own link for the pandal over building directions from
  // our own coordinates: the sheet's coordinates are good enough to place
  // a pin but several are road-level rather than exact, and two arrived as
  // DMS strings that had to be converted at import.
  const directionsUrl = place?.maps_url || `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;

  const knownFor = place?.known_for?.trim() ?? "";
  const needsClamp = knownFor.length > KNOWN_FOR_CLAMP_CHARS;
  const knownForText = needsClamp && !expanded ? `${knownFor.slice(0, KNOWN_FOR_CLAMP_CHARS).trimEnd()}…` : knownFor;

  /**
   * Shares a link that actually reopens THIS pandal.
   *
   * The version inherited from the cafe map wrote `?lat=…&lng=…` — and
   * nothing anywhere read those parameters back, so every link anyone
   * shared opened the plain map instead of the place they meant to send.
   * On a festival map that is not a cosmetic bug: a forwarded link is how
   * most people arrive, so the whole distribution loop was leaking its
   * visitors onto a generic view.
   *
   * `?place=<id>` is read by MapExperience, which opens the card and flies
   * the camera to it. An id rather than coordinates because the receiving
   * end has to find the row anyway, and coordinates cannot survive a pin
   * being corrected later — several of these were.
   *
   * A billboard gets a bare link. It is a paid placement, not a
   * destination, and a parameter that resolves to nothing would be the
   * same lie in a different shape.
   */
  async function share() {
    // Always /map, never window.location.pathname: this card also opens
    // on /admin, and a link shared from there would send a visitor to a
    // sign-in screen instead of the pandal.
    const base = `${window.location.origin}/map`;
    const url = isPlace ? `${base}?place=${encodeURIComponent(item.id)}` : base;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, url });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently no-op
    }
  }

  return (
    <div
      ref={sheetRef}
      className={`detail-card panel-elevated w-full shrink-0 overflow-hidden rounded-3xl ${isPlace ? "detail-card-place" : "detail-card-ad"}`}
      role="dialog"
      aria-label={item.name}
    >
      {/* Visible only on small screens (CSS). Purely the visual cue that
          the sheet can be dragged away — deliberately not a button: the
          drag listener sits on the card itself, so a tappable grabber
          would fire its click at the end of any drag that did not travel
          far enough to dismiss, closing the card the user was trying to
          pull back. There are already four ways out (swipe, the 44px X,
          tapping the map, Escape). */}
      <div className="detail-card-grabber" aria-hidden="true">
        <span />
      </div>

      {/* A photo, when there is one, is a full-width banner rather than a
          thumbnail tile. The v1 dataset has no uploaded photos at all —
          the research sheet carries Instagram links, which cannot be
          embedded — so absent one the name simply leads, which reads as
          deliberate rather than as a gap. */}
      {isPlace && place?.image_url && !imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.image_url} alt="" className="detail-card-banner" onError={() => setImageFailed(true)} />
      )}

      <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5">
        <div className="min-w-0">
          <h2 className="detail-card-name truncate">{item.name}</h2>
          <div className="detail-card-meta truncate">
            {isPlace
              ? place?.area
              : billboard?.ad_type === "rail"
                ? "Centre map sponsor"
                : `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`}
          </div>
        </div>
        <button
          onClick={onClose}
          className="panel-close-button shrink-0 rounded-full text-[var(--ink-muted)] hover:bg-[var(--accent-tint)] hover:text-[var(--accent-deep)]"
          aria-label="Close"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-3.5 pt-2.5 pb-1">
        {/* The card's one emphasised element, and the thing a general map
            cannot tell you: whether this is standing right now and how
            long you have left to see it. This occupies the slot the
            reference card gave to its verified-rating seal — the same
            structural idea (one claim, stated once, at the top), with the
            claim this product can actually make.
            Coral, because the design system reserves coral for live
            signals and urgency. Never saffron: saffron means advertising
            here, and a pandal must not read as a paid placement. */}
        {isPlace && timing && (
          <div className={`season-strip ${live ? "is-live" : ""}`}>
            <span className="season-strip-dot" aria-hidden="true" />
            <span className="season-strip-state">{live ? "Live now" : "Not open yet"}</span>
            <span className="season-strip-timing">{timing}</span>
          </div>
        )}

        {/* The only editorial writing on the card, so it leads the body
            rather than sitting under rows of chrome. Neutral surface, so
            saffron stays reserved for sponsored content. */}
        {isPlace && knownFor && (
          <div className="known-for">
            <div className="known-for-eyebrow">Known for</div>
            <p className="known-for-text">{knownForText}</p>
            {needsClamp && (
              <button type="button" className="known-for-toggle" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {isPlace && place?.theme && (
          <div className="known-for known-for-secondary">
            <div className="known-for-eyebrow">This year&apos;s theme</div>
            <p className="known-for-text">{place.theme}</p>
          </div>
        )}

        {/* Capped: a wall of equal-weight chips reads as noise rather than
            information. The v1 dataset seeds no tags at all, so this
            renders nothing until an admin adds some — see
            lib/vocabulary.ts on why the vocabulary comes from the rows. */}
        {isPlace && place && place.tags.length > 0 && (
          <div className="detail-card-tags">
            {place.tags.slice(0, TAG_DISPLAY_LIMIT).map((tag) => (
              <span key={tag} className="detail-card-tag">
                {tag}
              </span>
            ))}
            {place.tags.length > TAG_DISPLAY_LIMIT && (
              <span className="detail-card-tag detail-card-tag-more">+{place.tags.length - TAG_DISPLAY_LIMIT}</span>
            )}
          </div>
        )}

        {billboard && (
          <div className="sponsored-note">
            <div className="sponsored-note-eyebrow">Sponsored placement</div>
            <div className="sponsored-note-name">{billboard.name}</div>
            {billboard.target_url && (
              <a href={billboard.target_url} target="_blank" rel="noopener noreferrer" className="sponsored-note-link">
                Visit brand
              </a>
            )}
          </div>
        )}
      </div>

      {/* One primary action, then icons. Directions is the reason most
          people open a pandal card at all, so it is not one of four
          equal-weight cells. */}
      <div className="detail-card-actions">
        {billboard?.ad_type === "rail" ? (
          <span className="detail-card-action-primary detail-card-action-static">
            <span aria-hidden="true">▦</span>
            Map rail placement
          </span>
        ) : (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="detail-card-action-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4">
              <path d="M3 11l18-8-8 18-2-8-8-2z" strokeLinejoin="round" />
            </svg>
            Directions
          </a>
        )}
        <button
          onClick={share}
          aria-label="Share this pandal"
          title={copied ? "Link copied" : "Share"}
          className={`detail-card-action-icon ${copied ? "is-active" : ""}`}
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
              <circle cx="18" cy="5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="19" r="2.5" />
              <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" />
            </svg>
          )}
        </button>
      </div>

      {/* The full street address is deliberately not shown: the area is on
          the header line and Directions covers actually getting there, so
          the address would be a third way of saying where a place is.
          It is only hidden, not dropped — places.address still holds it,
          the admin form still edits it, and it is what a maps_url gets
          rebuilt from if one is ever missing.
          The media link names its destination ("instagram.com/…") rather
          than the column it came from. It is a plain outbound link
          because Instagram and Facebook both block embedding. */}
      {isPlace && place?.media_url && (
        <div className="detail-card-footnote">
          <a href={place.media_url} target="_blank" rel="noopener noreferrer" className="detail-card-link">
            {prettyLink(place.media_url)}
          </a>
        </div>
      )}

      {isPlace && place && isAdmin && props.kind === "place" && (
        <EditPandalDetails
          place={place}
          accessToken={props.adminAccessToken ?? null}
          onSaved={(updated) => props.onPlaceUpdated?.(updated)}
        />
      )}
    </div>
  );
}
