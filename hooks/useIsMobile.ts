"use client";

import * as React from "react";

/**
 * Ported directly from Tiptap's own UI Components library
 * (hooks/use-mobile.ts, MIT licensed: github.com/ueberdosis/
 * tiptap-ui-components) — no dependencies, no changes from the real
 * source beyond the filename convention (this app's other hooks/utils
 * use camelCase filenames rather than kebab-case).
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    mql.addEventListener("change", onChange);
    // Syncs from window.innerWidth (an external system) on mount, kept
    // matching Tiptap's real upstream source per the file header above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(window.innerWidth < breakpoint);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return !!isMobile;
}
