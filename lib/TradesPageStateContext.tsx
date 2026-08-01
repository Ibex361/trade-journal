"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useAccount } from "@/lib/AccountContext";
import { TradeFilters, EMPTY_FILTERS } from "@/components/trades/TradesFilterBar";
import { SortState } from "@/components/trades/TradesList";

type TradesPageStateContextType = {
  filters: TradeFilters;
  setFilters: (filters: TradeFilters) => void;
  sort: SortState;
  setSort: (sort: SortState) => void;
  resetFilters: () => void;
};

const TradesPageStateContext = createContext<TradesPageStateContextType | null>(null);

// Mounted once in the root layout (which never unmounts on navigation,
// unlike the page components under it), so filters/sort survive bouncing
// between Trades and other tabs. Same pattern as AccountContext and
// WinRateModeContext — pure in-memory state, nothing persisted or written
// to the DB, and it resets naturally on a hard refresh.
export function TradesPageStateProvider({ children }: { children: ReactNode }) {
  const { selectedAccount } = useAccount();
  const [filters, setFilters] = useState<TradeFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ column: "entry_date", direction: "desc" });

  // Filters should reset when the user actually switches accounts, but not
  // just because the Trades page happens to remount (e.g. navigating back
  // to it) — a `useEffect` for that has to live here, in a component that
  // never itself remounts, rather than on the page. A ref (not the effect's
  // dependency array alone) is what tells "account genuinely changed" apart
  // from "component mounted fresh with the same account it already had" —
  // an effect always runs once on mount no matter what its deps were last
  // time, since there is no "last time" for a fresh mount to compare against.
  const prevAccountId = useRef(selectedAccount?.id);
  useEffect(() => {
    if (prevAccountId.current !== selectedAccount?.id) {
      prevAccountId.current = selectedAccount?.id;
      setFilters(EMPTY_FILTERS);
    }
  }, [selectedAccount?.id]);

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <TradesPageStateContext.Provider value={{ filters, setFilters, sort, setSort, resetFilters }}>
      {children}
    </TradesPageStateContext.Provider>
  );
}

export function useTradesPageState() {
  const ctx = useContext(TradesPageStateContext);
  if (!ctx) {
    throw new Error("useTradesPageState must be used within TradesPageStateProvider");
  }
  return ctx;
}

