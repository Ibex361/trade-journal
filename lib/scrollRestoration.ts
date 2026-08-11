// Plain module-level state (not React state) — navigating between pages
// doesn't reload this module, so it survives route changes without needing
// a Context or triggering any re-renders. Resets on a hard refresh, same as
// the page-state contexts.
const scrollPositions = new Map<string, number>();

export function getSavedScroll(key: string): number {
  return scrollPositions.get(key) ?? 0;
}

export function saveScroll(key: string, y: number) {
  scrollPositions.set(key, y);
}
