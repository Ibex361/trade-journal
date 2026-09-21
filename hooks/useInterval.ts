import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `delayMs` while `delayMs` is a number; pass null
 * to pause. The callback is held in a ref so a changing closure never
 * resets the timer (the classic setInterval-in-hooks bug), and the timer
 * is cleared on unmount so a page navigated away from stops polling.
 */
export function useInterval(callback: () => void, delayMs: number | null) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => saved.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
