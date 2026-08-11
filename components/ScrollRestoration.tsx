"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getSavedScroll, saveScroll } from "@/lib/scrollRestoration";

/**
 * Mounted once in the root layout. Records how far down each route was
 * scrolled, and puts you back there when you navigate back to it.
 *
 * Two things make this trickier than a single `window.scrollTo`:
 * - The layout (and this component) never unmount on navigation, but the
 *   page underneath it does — so scroll position has to be tracked
 *   continuously via a live listener, not captured once "on the way out".
 * - A page's content (trade list, charts) often renders a skeleton first
 *   and grows once data loads, so the saved position may not be reachable
 *   yet the instant you land back on the route. We nudge the scroll back
 *   into place on repeated animation frames until it sticks or we give up.
 */
export default function ScrollRestoration() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        saveScroll(pathRef.current, window.scrollY);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const target = getSavedScroll(pathname);
    if (target <= 0) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 45; // generous window for slower data loads, ~a few frames short of a second

    function tryRestore() {
      if (cancelled) return;
      window.scrollTo(0, target);
      attempts++;
      if (Math.abs(window.scrollY - target) > 2 && attempts < maxAttempts) {
        requestAnimationFrame(tryRestore);
      }
    }
    tryRestore();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
