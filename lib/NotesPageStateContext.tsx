"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useAccount } from "@/lib/AccountContext";
import { NoteFilters, EMPTY_NOTE_FILTERS } from "@/components/notes/NotesFilterBar";

type NotesPageStateContextType = {
  filters: NoteFilters;
  setFilters: (filters: NoteFilters) => void;
  resetFilters: () => void;
};

const NotesPageStateContext = createContext<NotesPageStateContextType | null>(null);

// Same pattern as TradesPageStateProvider/AnalyticsPageStateProvider/
// StrategiesPageStateProvider: mounted once in the root layout (which never
// unmounts on navigation, unlike the page component under it), so a search/
// tag filter survives bouncing between Notes and other tabs. Pure in-memory
// state — resets naturally on a hard refresh.
export function NotesPageStateProvider({ children }: { children: ReactNode }) {
  const { selectedAccount } = useAccount();
  const [filters, setFilters] = useState<NoteFilters>(EMPTY_NOTE_FILTERS);

  // Filters should reset when the user actually switches accounts, but not
  // just because the Notes page happens to remount (e.g. navigating back to
  // it) — a ref (not the effect's dependency array alone) is what tells
  // "account genuinely changed" apart from "component mounted fresh with the
  // same account it already had", since an effect always runs once on mount
  // regardless of whether its deps actually changed since "last time" (a
  // fresh mount has no "last time" to compare against).
  const prevAccountId = useRef(selectedAccount?.id);
  useEffect(() => {
    if (prevAccountId.current !== selectedAccount?.id) {
      prevAccountId.current = selectedAccount?.id;
      setFilters(EMPTY_NOTE_FILTERS);
    }
  }, [selectedAccount?.id]);

  function resetFilters() {
    setFilters(EMPTY_NOTE_FILTERS);
  }

  return (
    <NotesPageStateContext.Provider value={{ filters, setFilters, resetFilters }}>
      {children}
    </NotesPageStateContext.Provider>
  );
}

export function useNotesPageState() {
  const ctx = useContext(NotesPageStateContext);
  if (!ctx) {
    throw new Error("useNotesPageState must be used within NotesPageStateProvider");
  }
  return ctx;
}
