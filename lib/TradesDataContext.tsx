"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAccount } from "./AccountContext";
import { fetchTrades, Trade } from "./trades";

type TradesDataContextType = {
  trades: Trade[];
  loading: boolean;
  refreshTrades: () => Promise<void>;
};

const TradesDataContext = createContext<TradesDataContextType>({
  trades: [],
  loading: true,
  refreshTrades: async () => {},
});

/**
 * Fetches the selected account's trades once and shares them across every
 * page that needs them (Dashboard, Trades, Analytics, Reports) instead of
 * each page independently re-fetching the full trade list on every visit —
 * that was four separate `select("*")` round-trips to Supabase for data
 * that's identical between them.
 *
 * Trades are re-fetched only when the selected account changes, or when
 * something that mutates trades calls `refreshTrades()` to bring the cache
 * back in sync: adding/editing/deleting a trade or a bulk action on the
 * Trades page, a CSV import, or the legacy screenshot migration in
 * Settings. This is the single source of truth for trade data — pages
 * should read from here rather than calling `fetchTrades` directly.
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
    refreshTrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  return (
    <TradesDataContext.Provider value={{ trades, loading, refreshTrades }}>
      {children}
    </TradesDataContext.Provider>
  );
}

export function useTradesData() {
  return useContext(TradesDataContext);
}
