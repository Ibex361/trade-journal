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
  selectedAccount: Account | null;
  selectAccount: (id: string) => void;
  loading: boolean;
  refreshAccounts: () => Promise<void>;
};

const AccountContext = createContext<AccountContextType>({
  accounts: [],
  selectedAccount: null,
  selectAccount: () => {},
  loading: true,
  refreshAccounts: async () => {},
});

const STORAGE_KEY = "trade-journal:selected-account";

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshAccounts() {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setAccounts(data as Account[]);
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const stillExists = data.find((a) => a.id === stored);
      if (stillExists) {
        setSelectedId(stored);
      } else if (data.length > 0) {
        setSelectedId(data[0].id);
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
      value={{ accounts, selectedAccount, selectAccount, loading, refreshAccounts }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
