import { supabase } from "./supabaseClient";

export type Direction = "long" | "short";

export type Trade = {
  id: string;
  account_id: string;
  entry_date: string;
  instrument: string;
  asset_class: string | null;
  strategy: string | null;
  session: string | null;
  emotion: string | null;
  direction: Direction | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss_price: number | null;
  size: number | null;
  pnl: number;
  r_multiple: number | null;
  rules_followed: boolean | null;
  notes: string | null;
  screenshot_url: string | null;
  tags: string[];
  created_at: string;
};

export type TradeInput = {
  entry_date: string;
  instrument: string;
  asset_class: string | null;
  strategy: string | null;
  session: string | null;
  emotion: string | null;
  direction: Direction | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss_price: number | null;
  size: number | null;
  pnl: number;
  r_multiple: number | null;
  rules_followed: boolean | null;
  notes: string | null;
  screenshot_url: string | null;
  tags: string[];
};

export async function fetchTrades(accountId: string) {
  return supabase
    .from("trades")
    .select("*")
    .eq("account_id", accountId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function createTrade(accountId: string, input: TradeInput) {
  const result = await supabase.from("trades").insert({
    account_id: accountId,
    ...input,
  });
  if (result.error) console.error("createTrade failed:", result.error);
  return result;
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

/** Narrow update used by the bulk "add tag" action — only touches the tags column. */
export async function updateTradeTags(id: string, tags: string[]) {
  const result = await supabase.from("trades").update({ tags }).eq("id", id);
  if (result.error) console.error("updateTradeTags failed:", result.error);
  return result;
}
