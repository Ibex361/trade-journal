import { supabase } from "./supabaseClient";

export type Direction = "long" | "short";

export type Trade = {
  id: string;
  account_id: string;
  entry_date: string;
  entry_time: string | null;
  exit_date: string | null;
  exit_time: string | null;
  instrument: string;
  asset_class: string | null;
  strategy: string | null;
  session: string | null;
  emotion: string | null;
  direction: Direction | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  size: number | null;
  pnl: number;
  r_multiple: number | null;
  rules_followed: boolean | null;
  notes: string | null;
  screenshot_url: string | null;
  tags: string[];
  broker_ticket: string | null;
  created_at: string;
};

export type TradeInput = {
  entry_date: string;
  entry_time: string | null;
  exit_date: string | null;
  exit_time: string | null;
  instrument: string;
  asset_class: string | null;
  strategy: string | null;
  session: string | null;
  emotion: string | null;
  direction: Direction | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  size: number | null;
  pnl: number;
  r_multiple: number | null;
  rules_followed: boolean | null;
  notes: string | null;
  screenshot_url: string | null;
  tags: string[];
  // The broker's own trade ID, when this trade came from a broker CSV
  // import (e.g. Exness' "ticket"). Null for manually-entered trades.
  // Used to skip a trade that's already been imported on re-import.
  broker_ticket: string | null;
};

export async function fetchTrades(accountId: string) {
  return supabase
    .from("trades")
    .select("*")
    .eq("account_id", accountId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
}

/**
 * Returns the set of broker_ticket values already stored for this account,
 * so a broker CSV import (e.g. Exness) can skip trades it's already
 * imported instead of creating duplicates when the export ranges overlap.
 */
export async function getExistingBrokerTickets(accountId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("trades")
    .select("broker_ticket")
    .eq("account_id", accountId)
    .not("broker_ticket", "is", null);
  if (error) {
    console.error("getExistingBrokerTickets failed:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.broker_ticket as string).filter(Boolean));
}

export async function createTrade(accountId: string, input: TradeInput) {
  const result = await supabase.from("trades").insert({
    account_id: accountId,
    ...input,
  });
  if (result.error) console.error("createTrade failed:", result.error);
  return result;
}

/**
 * Bulk insert used by CSV import. Sent in chunks rather than one request —
 * a large journal (thousands of rows) can exceed a single request's payload
 * limits, and chunking also means a failure partway through reports how
 * many rows actually made it in rather than an all-or-nothing error.
 */
export async function createTrades(accountId: string, inputs: TradeInput[]) {
  const CHUNK_SIZE = 200;
  let inserted = 0;
  for (let i = 0; i < inputs.length; i += CHUNK_SIZE) {
    const chunk = inputs.slice(i, i + CHUNK_SIZE).map((input) => ({ account_id: accountId, ...input }));
    const result = await supabase.from("trades").insert(chunk);
    if (result.error) {
      console.error("createTrades failed:", result.error);
      return { inserted, error: result.error };
    }
    inserted += chunk.length;
  }
  return { inserted, error: null };
}

export async function updateTrade(id: string, input: TradeInput) {
  const result = await supabase.from("trades").update(input).eq("id", id);
  if (result.error) console.error("updateTrade failed:", result.error);
  return result;
}

export async function deleteTrade(id: string) {
  const result = await supabase.from("trades").delete().eq("id", id);
  if (result.error) console.error("deleteTrade failed:", result.error);
  return result;
}

/** Deletes multiple trades in a single request — used by the Trades page's bulk-delete action. */
export async function deleteTrades(ids: string[]) {
  const result = await supabase.from("trades").delete().in("id", ids);
  if (result.error) console.error("deleteTrades failed:", result.error);
  return result;
}

/** Narrow update used by the bulk "add/remove tag" actions — only touches the tags column. */
export async function updateTradeTags(id: string, tags: string[]) {
  const result = await supabase.from("trades").update({ tags }).eq("id", id);
  if (result.error) console.error("updateTradeTags failed:", result.error);
  return result;
}

/** Narrow update used by the bulk "mark rules followed" action — only touches rules_followed. */
export async function updateTradeRules(id: string, rules_followed: boolean | null) {
  const result = await supabase.from("trades").update({ rules_followed }).eq("id", id);
  if (result.error) console.error("updateTradeRules failed:", result.error);
  return result;
}
