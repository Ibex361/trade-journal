"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode, Dispatch, SetStateAction } from "react";
import { useAccount } from "@/lib/AccountContext";

type StrategiesPageStateContextType = {
  selectedStrategyKey: string | null;
  setSelectedStrategyKey: Dispatch<SetStateAction<string | null>>;
};

const StrategiesPageStateContext = createContext<StrategiesPageStateContextType | null>(null);

// Same pattern as TradesPageStateProvider/AnalyticsPageStateProvider: mounted
// once in the root layout (which never unmounts on navigation, unlike the
// page component under it), so the selected strategy row survives bouncing
// between Strategies and other tabs. Pure in-memory state — resets naturally
// on a hard refresh.
export function StrategiesPageStateProvider({ children }: { children: ReactNode }) {
  const { selectedAccount } = useAccount();
  const [selectedStrategyKey, setSelectedStrategyKey] = useState<string | null>(null);

  // Selection should reset when the user actually switches accounts, but not
  // just because the Strategies page happens to remount (e.g. navigating
  // back to it) — a ref (not the effect's dependency array alone) is what
  // tells "account genuinely changed" apart from "component mounted fresh
  // with the same account it already had", since an effect always runs once
  // on mount regardless of whether its deps actually changed since "last
  // time" (a fresh mount has no "last time" to compare against).
  const prevAccountId = useRef(selectedAccount?.id);
  useEffect(() => {
    if (prevAccountId.current !== selectedAccount?.id) {
      prevAccountId.current = selectedAccount?.id;
      setSelectedStrategyKey(null);
    }
  }, [selectedAccount?.id]);

  return (
    <StrategiesPageStateContext.Provider value={{ selectedStrategyKey, setSelectedStrategyKey }}>
      {children}
    </StrategiesPageStateContext.Provider>
  );
}

export function useStrategiesPageState() {
  const ctx = useContext(StrategiesPageStateContext);
  if (!ctx) {
    throw new Error("useStrategiesPageState must be used within StrategiesPageStateProvider");
  }
  return ctx;
}
