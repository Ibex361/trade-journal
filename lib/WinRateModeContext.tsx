"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

/**
 * Two conventions for win rate, both computed off the same trades so they
 * can never disagree — see summarizeTrades in lib/metrics.ts.
 *
 * "strict"  — wins ÷ ALL trades. Breakeven trades count against you. This
 *             is the app's default.
 * "decided" — wins ÷ (wins + losses). Breakeven trades are excluded
 *             entirely, from both sides of the fraction.
 */
export type WinRateMode = "strict" | "decided";

export const WIN_RATE_MODE_LABELS: Record<WinRateMode, string> = {
  strict: "Counts breakeven as a loss",
  decided: "Excludes breakeven trades",
};

type WinRateModeContextType = {
  mode: WinRateMode;
  setMode: (mode: WinRateMode) => void;
};

const STORAGE_KEY = "trade-journal:win-rate-mode";

const WinRateModeContext = createContext<WinRateModeContextType>({
  mode: "strict",
  setMode: () => {},
});

export function WinRateModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<WinRateMode>("strict");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "strict" || stored === "decided") setModeState(stored);
  }, []);

  function setMode(next: WinRateMode) {
    setModeState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  return (
    <WinRateModeContext.Provider value={{ mode, setMode }}>{children}</WinRateModeContext.Provider>
  );
}

export function useWinRateMode() {
  return useContext(WinRateModeContext);
}
