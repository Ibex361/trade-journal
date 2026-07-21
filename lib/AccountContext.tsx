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
    refreshAccounts();
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
