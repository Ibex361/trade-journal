"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase, Account } from "./supabaseClient";

type AccountContextType = {
  accounts: Account[];
  archivedAccounts: Account[];
  selectedAccount: Account | null;
  selectAccount: (id: string) => void;
  loading: boolean;
  refreshAccounts: () => Promise<void>;
};

const AccountContext = createContext<AccountContextType>({
  accounts: [],
  archivedAccounts: [],
  selectedAccount: null,
  selectAccount: () => {},
  loading: true,
  refreshAccounts: async () => {},
});

const STORAGE_KEY = "trade-journal:selected-account";

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [archivedAccounts, setArchivedAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshAccounts() {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data) {
      const active = (data as Account[]).filter((a) => !a.is_archived);
      const archived = (data as Account[]).filter((a) => a.is_archived);
      setAccounts(active);
      setArchivedAccounts(archived);
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const stillExists = active.find((a) => a.id === stored);
      if (stillExists) {
        setSelectedId(stored);
      } else if (active.length > 0) {
        setSelectedId(active[0].id);
      } else {
        setSelectedId(null);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    let initialFetchDone = false;

    async function init() {
      // The browser client loads the session from the cookie asynchronously.
      // If we query before that finishes, the request goes out looking
      // signed-out, and RLS silently returns zero rows instead of an error —
      // which looked like "no accounts" right after logging in. Waiting for
      // getSession() first ensures the very first query is authenticated.
      await supabase.auth.getSession();
      if (active) {
        await refreshAccounts();
        initialFetchDone = true;
      }
    }
    init();

    // Also refetch on sign-in/sign-out elsewhere in the app, so state never
    // goes stale relative to the actual session. Ignore the listener's own
    // initial firing (it fires once immediately with whatever session is
    // already known) — init() above already covers that first load, so
    // acting on it too would just be a redundant duplicate fetch.
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      if (!initialFetchDone) return;
      refreshAccounts();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  function selectAccount(id: string) {
    setSelectedId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }

  const selectedAccount = accounts.find((a) => a.id === selectedId) || null;

  return (
    <AccountContext.Provider
      value={{ accounts, archivedAccounts, selectedAccount, selectAccount, loading, refreshAccounts }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
