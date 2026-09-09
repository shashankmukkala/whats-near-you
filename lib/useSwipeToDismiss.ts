"use client";

import { useCallback, useEffect, useRef } from "react";

const DISMISS_DISTANCE_PX = 110;
const DISMISS_VELOCITY = 0.55; // px per ms
const RESISTANCE = 0.35; // how much an upward drag is damped

/**
 * Drag-down-to-dismiss for a bottom sheet.
 *
 * Written against the DOM rather than React state on purpose: a drag fires
 * a touchmove roughly every frame, and routing each one through setState
 * would re-render the whole card (photo, tags, review list) 60 times a
 * second. Instead the transform is written straight to the node, so the
 * drag is a compositor-only operation — the same reason it stays smooth on
 * a mid-range phone.
 *
 * Only `transform` and `opacity` are touched, both GPU-composited. No
 * layout property is written during the gesture, so nothing reflows.
 */
export function useSwipeToDismiss<T extends HTMLElement>(onDismiss: () => void, enabled: boolean) {
  const ref = useRef<T | null>(null);
  const startY = useRef(0);
  const startTime = useRef(0);
  const currentY = useRef(0);
  const dragging = useRef(false);

  // Kept in a ref so the listeners below never need re-binding when the
  // parent re-renders with a new callback identity.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const reset = useCallback((animate: boolean) => {
    const node = ref.current;
    if (!node) return;
    node.style.transition = animate ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms" : "";
    node.style.transform = "";
    node.style.opacity = "";
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      // Only start a dismiss drag from the top of the sheet's own scroll.
      // Otherwise a flick while reading reviews would close the card
      // instead of scrolling it.
      if (node!.scrollTop > 0) return;
      dragging.current = true;
      startY.current = event.touches[0].clientY;
      currentY.current = 0;
      startTime.current = performance.now();
      node!.style.transition = "";
    }

    function onTouchMove(event: TouchEvent) {
      if (!dragging.current) return;
      const delta = event.touches[0].clientY - startY.current;
      // Upward drags are damped rather than blocked, so the sheet feels
      // attached to the finger instead of dead at the boundary.
      const offset = delta < 0 ? delta * RESISTANCE : delta;
      currentY.current = offset;
      node!.style.transform = `translate3d(0, ${offset}px, 0)`;
      if (offset > 0) {
        node!.style.opacity = String(Math.max(0.4, 1 - offset / (DISMISS_DISTANCE_PX * 3)));
      }
    }

    function onTouchEnd() {
      if (!dragging.current) return;
      dragging.current = false;
      const travelled = currentY.current;
      const velocity = travelled / Math.max(1, performance.now() - startTime.current);

      // A short flick counts as much as a long drag — matching how every
      // native sheet behaves, and forgiving of small screens where there
      // is not much room to drag.
      if (travelled > DISMISS_DISTANCE_PX || velocity > DISMISS_VELOCITY) {
        node!.style.transition = "transform 180ms ease-in, opacity 180ms ease-in";
        node!.style.transform = `translate3d(0, ${node!.offsetHeight}px, 0)`;
        node!.style.opacity = "0";
        window.setTimeout(() => onDismissRef.current(), 160);
        return;
      }
      reset(true);
    }

    // passive: the handler never calls preventDefault, and saying so lets
    // the browser keep scrolling on the compositor thread instead of
    // waiting to find out.
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    node.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
      dragging.current = false;
    };
  }, [enabled, reset]);

  return ref;
}
