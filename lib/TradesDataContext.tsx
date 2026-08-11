"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useAccount } from "./AccountContext";
import { fetchTrades, Trade } from "./trades";

type TradesDataContextType = {
  trades: Trade[];
  loading: boolean;
  refreshTrades: () => Promise<void>;
  // Local-cache patch helpers — see the block comment above their
  // implementations below for why these exist and when to use them
  // instead of refreshTrades().
  upsertTradeLocal: (trade: Trade) => void;
  removeTradesLocal: (ids: string[]) => void;
  patchTradesLocal: (ids: string[], patch: (trade: Trade) => Trade) => void;
};

const TradesDataContext = createContext<TradesDataContextType>({
  trades: [],
  loading: true,
  refreshTrades: async () => {},
  upsertTradeLocal: () => {},
  removeTradesLocal: () => {},
  patchTradesLocal: () => {},
});

/**
 * Fetches the selected account's trades once and shares them across every
 * page that needs them (Dashboard, Trades, Analytics, Reports) instead of
 * each page independently re-fetching the full trade list on every visit —
 * that was four separate `select("*")` round-trips to Supabase for data
 * that's identical between them.
 *
 * Trades are re-fetched from Supabase only when the selected account
 * changes. Every other mutation — adding/editing/deleting a trade, or a
 * bulk tag/rules action on the Trades page — updates the shared cache
 * directly via `upsertTradeLocal`/`removeTradesLocal`/`patchTradesLocal`
 * instead of calling `refreshTrades()`, since the outcome of a one- or
 * few-row change is already known (or, for create/update, comes back
 * directly from the same request that made the change) without needing to
 * re-download the account's entire trade history to find out. A full
 * `refreshTrades()` is still the right call for anything that mutates an
 * unknown/bulk set of rows server-side with no cheaper way to learn what
 * changed — CSV import and the legacy screenshot migration in Settings are
 * the two remaining callers. This is the single source of truth for trade
 * data — pages should read from here rather than calling `fetchTrades`
 * directly.
 */
export function TradesDataProvider({ children }: { children: ReactNode }) {
  const { selectedAccount } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  // Keyed on the id, not the object — same reasoning as the notes-fetch
  // effect in app/notes/page.tsx (spurious object-identity churn from
  // AccountContext shouldn't re-trigger this fetch).
  const refreshTrades = useCallback(async () => {
    if (!selectedAccount) {
      setTrades([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await fetchTrades(selectedAccount.id);
    if (data) setTrades(data as Trade[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  // Re-fetch whenever the selected account changes (including the initial
  // resolve from AccountContext). Every other trigger to refresh is
  // explicit, via the pages/components below calling `refreshTrades()`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refreshTrades' setLoading(true)/setTrades([]) run before its first await, same as loadDropdowns in app/trades/page.tsx.
    refreshTrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  // Patches the shared trade cache in place instead of re-fetching the
  // account's entire trade history from Supabase — see this file's
  // docstring. These three cover every way a mutation can change the
  // cache: one row replaced with the server's authoritative copy (create/
  // update, where computed columns or defaults might differ from what the
  // client sent), some rows removed (delete/bulk delete), or the same
  // patch applied to a known set of rows (bulk tag/rules actions, where
  // the new value is fully determined client-side — no server round-trip
  // needed to know the result). A full refreshTrades() is still correct
  // and used for anything that touches an unknown/bulk set server-side —
  // CSV import, the legacy screenshot migration — where there's no
  // cheaper way to learn what changed.
  const upsertTradeLocal = useCallback((trade: Trade) => {
    setTrades((prev) => {
      const idx = prev.findIndex((t) => t.id === trade.id);
      if (idx === -1) {
        // New trade — keep the existing order (entry_date desc, then
        // created_at desc, per fetchTrades) rather than appending, so a
        // freshly-created trade lands where a refetch would have put it.
        const next = [...prev, trade];
        next.sort(
          (a, b) =>
            b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at)
        );
        return next;
      }
      const next = [...prev];
      next[idx] = trade;
      return next;
    });
  }, []);

  const removeTradesLocal = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setTrades((prev) => prev.filter((t) => !idSet.has(t.id)));
  }, []);

  const patchTradesLocal = useCallback((ids: string[], patch: (trade: Trade) => Trade) => {
    const idSet = new Set(ids);
    setTrades((prev) => prev.map((t) => (idSet.has(t.id) ? patch(t) : t)));
  }, []);

  // Memoized so this provider only hands consumers (Dashboard, Trades,
  // Analytics, Reports, Strategies) a new context value when trades/loading
  // actually changed — otherwise every re-render of this component (e.g.
  // triggered by re-rendering as a consumer of AccountContext) would pass a
  // brand-new object down and re-render all of them for no reason.
  const value = useMemo(
    () => ({ trades, loading, refreshTrades, upsertTradeLocal, removeTradesLocal, patchTradesLocal }),
    [trades, loading, refreshTrades, upsertTradeLocal, removeTradesLocal, patchTradesLocal]
  );

  return <TradesDataContext.Provider value={value}>{children}</TradesDataContext.Provider>;
}

export function useTradesData() {
  return useContext(TradesDataContext);
}
