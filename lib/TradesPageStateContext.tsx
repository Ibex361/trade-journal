"use client";

import { createContext, useCallback, useContext, useState, useEffect, useMemo, useRef, ReactNode } from "react";
import { useAccount } from "@/lib/AccountContext";
import { TradeFilters, EMPTY_FILTERS } from "@/components/trades/TradesFilterBar";
import { SortState } from "@/components/trades/TradesList";

type TradesPageStateContextType = {
  filters: TradeFilters;
  setFilters: (filters: TradeFilters) => void;
  sort: SortState;
  setSort: (sort: SortState) => void;
  resetFilters: () => void;
  pendingTradeId: string | null;
  setPendingTradeId: (id: string | null) => void;
  pendingNewTrade: boolean;
  setPendingNewTrade: (pending: boolean) => void;
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
  // Set by the Notes page's "jump to this trade" action (a linked-trade
  // chip in NoteEditPanel) before navigating here — same "store just the
  // key, root-mounted context" approach the Trades→Notes diary shortcut
  // uses via NotesPageStateContext.activeNoteId. app/trades/page.tsx picks
  // this up in an effect once its own trades list has loaded, opens that
  // trade in TradeFormPanel, then clears it so it doesn't reopen on a
  // later, unrelated visit to Trades.
  const [pendingTradeId, setPendingTradeId] = useState<string | null>(null);
  // Set by MobileTabBar's FAB "New trade" choice before navigating to
  // /trades — same "store just a flag, root-mounted context" approach as
  // pendingTradeId above. app/trades/page.tsx picks this up in an effect
  // once trades has finished loading and calls openNew(), then clears it.
  const [pendingNewTrade, setPendingNewTrade] = useState(false);

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
      setPendingTradeId(null);
      setPendingNewTrade(false);
    }
  }, [selectedAccount?.id]);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      sort,
      setSort,
      resetFilters,
      pendingTradeId,
      setPendingTradeId,
      pendingNewTrade,
      setPendingNewTrade,
    }),
    [filters, sort, resetFilters, pendingTradeId, pendingNewTrade]
  );

  return <TradesPageStateContext.Provider value={value}>{children}</TradesPageStateContext.Provider>;
}

export function useTradesPageState() {
  const ctx = useContext(TradesPageStateContext);
  if (!ctx) {
    throw new Error("useTradesPageState must be used within TradesPageStateProvider");
  }
  return ctx;
}

