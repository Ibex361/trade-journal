"use client";

import { createContext, useContext, useState, ReactNode } from "react";
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
  const [filters, setFilters] = useState<TradeFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ column: "entry_date", direction: "desc" });

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
