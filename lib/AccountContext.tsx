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

  const refreshAccounts = useCallback(async () => {
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
  }, []);

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
    //
    // Filtered to SIGNED_IN/SIGNED_OUT only — the account list can't change
    // from anything else this event fires for. In particular, Supabase's
    // client auto-refreshes the access token in the background roughly
    // hourly for as long as a tab stays open, firing TOKEN_REFRESHED each
    // time; previously this handler ignored the event type entirely and
    // refetched on every firing, meaning every open tab silently re-ran the
    // accounts query and rebuilt new accounts/selectedAccount object
    // references on a timer, with no user action — which then re-rendered
    // every context consumer down the tree (see the memoized `value` below
    // and the same fix applied to the other root-mounted providers). Also
    // ignores USER_UPDATED/PASSWORD_RECOVERY/MFA events for the same reason.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!initialFetchDone) return;
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") refreshAccounts();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshAccounts is stable (useCallback, empty deps); omitting it here matches the original effect's empty dep array and avoids re-subscribing the listener on every render.
  }, []);

  const selectAccount = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedId) || null,
    [accounts, selectedId]
  );

  // Memoized so a re-render of this provider only produces a new context
  // value object when one of these fields actually changed — without this,
  // every consumer of useAccount() anywhere in the app (and every provider
  // nested below this one that itself calls useAccount(), e.g.
  // TradesDataProvider, TradesPageStateProvider, NotesPageStateProvider,
  // StrategiesPageStateProvider) re-renders on every render of this
  // component, cascading down the whole tree in app/layout.tsx.
  const value = useMemo(
    () => ({ accounts, archivedAccounts, selectedAccount, selectAccount, loading, refreshAccounts }),
    [accounts, archivedAccounts, selectedAccount, selectAccount, loading, refreshAccounts]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  return useContext(AccountContext);
}
