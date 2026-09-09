"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query.
 *
 * useSyncExternalStore rather than useState + useEffect: matchMedia is an
 * external store, and this is the same pattern the other hooks here use
 * for localStorage (useBookmarks, usePoints, useVisitTracking). It also
 * avoids the extra render an effect-then-setState would cost on every
 * mount, and getServerSnapshot keeps SSR honest — the server has no
 * viewport, so it reports false and the first client paint matches it.
 *
 * Anything whose *appearance* depends on viewport belongs in CSS. This is
 * only for behaviour CSS cannot express, like "opening a card should
 * close the list, but only on a phone".
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * The one breakpoint that changes behaviour rather than just layout: below
 * it, panels are full-width bottom sheets and only one may be open at a
 * time; at or above it, the right-hand column is wide enough for panels to
 * stack. Kept here so the value cannot drift from the `1023px` used by the
 * matching CSS in globals.css.
 */
export const MOBILE_QUERY = "(max-width: 1023px)";
