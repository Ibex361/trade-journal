import { supabase } from "./supabaseClient";
import { deleteScreenshotsByUrls } from "./screenshots";
import { seedDefaultDropdownItems } from "./dropdownSettings";

// Friendlier text for the one conflict we expect regularly
// (the accounts_name_unique index in phase1c_migration.sql,
// which applies to ALL accounts, active or archived).
// Any OTHER database error still gets shown, just with its
// original message — nothing fails silently.
function friendlyAccountError(message: string) {
  if (/duplicate key|already exists|unique constraint/i.test(message)) {
    return "An account with this name already exists.";
  }
  return message;
}

export async function createAccount(input: {
  name: string;
  broker: string;
  currency: string;
  starting_balance: number;
}) {
  const result = await supabase
    .from("accounts")
    .insert({
      name: input.name,
      broker: input.broker || null,
      currency: input.currency,
      starting_balance: input.starting_balance,
      is_demo: false,
    })
    .select()
    .single();
  if (result.error) {
    console.error("createAccount failed:", result.error);
    return { ...result, error: { ...result.error, message: friendlyAccountError(result.error.message) } };
  }

  // New accounts start with the standard asset class / strategy / session /
  // emotion options already in place, so trading can start right away
  // instead of building every dropdown list from scratch. Tags are left
  // empty on purpose — see seedDefaultDropdownItems. This is best-effort:
  // the account was already created successfully above, so a seeding
  // failure here is logged but doesn't fail account creation.
  const { error: seedError } = await seedDefaultDropdownItems(result.data.id);
  if (seedError) {
    console.error("seedDefaultDropdownItems failed:", seedError);
  }

  return result;
}

export async function renameAccount(id: string, name: string) {
  const result = await supabase.from("accounts").update({ name }).eq("id", id);
  if (result.error) {
    console.error("renameAccount failed:", result.error);
    return { ...result, error: { ...result.error, message: friendlyAccountError(result.error.message) } };
  }
  return result;
}

export async function updateAccountDetails(
  id: string,
  details: {
    broker: string;
    currency: string;
    starting_balance: number;
  }
) {
  const result = await supabase
    .from("accounts")
    .update({
      broker: details.broker || null,
      currency: details.currency,
      starting_balance: details.starting_balance,
    })
    .eq("id", id);
  if (result.error) {
    console.error("updateAccountDetails failed:", result.error);
    return { ...result, error: { ...result.error, message: friendlyAccountError(result.error.message) } };
  }
  return result;
}

export async function archiveAccount(id: string) {
  return supabase.from("accounts").update({ is_archived: true }).eq("id", id);
}

export async function restoreAccount(id: string) {
  return supabase.from("accounts").update({ is_archived: false }).eq("id", id);
}

export async function deleteAccountPermanently(id: string) {
  // The DB cascade (trades.account_id references accounts on delete cascade)
  // will remove the trade rows themselves, but it has no idea those rows
  // point at files in storage — clean those up first, or they'd sit
  // orphaned in the bucket forever.
  const { data: trades } = await supabase
    .from("trades")
    .select("screenshot_url")
    .eq("account_id", id)
    .not("screenshot_url", "is", null);

  if (trades && trades.length > 0) {
    const urls = trades.map((t) => t.screenshot_url as string);
    await deleteScreenshotsByUrls(urls);
  }

  return supabase.from("accounts").delete().eq("id", id);
}

export async function updateTargets(
  id: string,
  targets: {
    target_risk_pct: number | null;
    target_monthly_pnl: number | null;
    target_monthly_winrate: number | null;
  }
) {
  return supabase.from("accounts").update(targets).eq("id", id);
}

const DEMO_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

const DEMO_TRADES = [
  { entry_date_offset: 85, instrument: "EUR/USD", asset_class: "Forex", strategy: "Breakout", session: "London", emotion: "Calm", direction: "long", entry_price: 1.082, exit_price: 1.0865, size: 1.0, pnl: 450, r_multiple: 1.8, rules_followed: true, notes: "Clean breakout above range high, held for full move." },
  { entry_date_offset: 80, instrument: "US30", asset_class: "Indices", strategy: "Trend following", session: "New York", emotion: "Confident", direction: "long", entry_price: 34200, exit_price: 34410, size: 0.5, pnl: 210, r_multiple: 1.1, rules_followed: true, notes: "Rode the afternoon trend, exited into resistance." },
  { entry_date_offset: 76, instrument: "BTC/USD", asset_class: "Crypto", strategy: "Mean reversion", session: "Asia", emotion: "Anxious", direction: "short", entry_price: 43200, exit_price: 43850, size: 0.2, pnl: -260, r_multiple: -1.3, rules_followed: false, notes: "Faded a move too early, size was slightly oversized." },
  { entry_date_offset: 70, instrument: "GBP/USD", asset_class: "Forex", strategy: "Breakout", session: "London", emotion: "Calm", direction: "long", entry_price: 1.265, exit_price: 1.261, size: 1.0, pnl: -80, r_multiple: -0.4, rules_followed: true, notes: "Valid setup, stopped out on news spike." },
  { entry_date_offset: 65, instrument: "US30", asset_class: "Indices", strategy: "Trend following", session: "New York", emotion: "Confident", direction: "short", entry_price: 34800, exit_price: 34550, size: 0.5, pnl: 250, r_multiple: 1.4, rules_followed: true, notes: "Shorted rejection at prior high, textbook." },
  { entry_date_offset: 60, instrument: "EUR/USD", asset_class: "Forex", strategy: "Mean reversion", session: "London", emotion: "Impatient", direction: "short", entry_price: 1.091, exit_price: 1.094, size: 1.0, pnl: -300, r_multiple: -1.5, rules_followed: false, notes: "Entered before confirmation, chased the move." },
  { entry_date_offset: 55, instrument: "BTC/USD", asset_class: "Crypto", strategy: "Breakout", session: "Asia", emotion: "Confident", direction: "long", entry_price: 41200, exit_price: 42100, size: 0.2, pnl: 180, r_multiple: 1.6, rules_followed: true, notes: "Range breakout with volume confirmation." },
  { entry_date_offset: 48, instrument: "GBP/USD", asset_class: "Forex", strategy: "Trend following", session: "London", emotion: "Calm", direction: "long", entry_price: 1.2705, exit_price: 1.276, size: 1.0, pnl: 550, r_multiple: 2.1, rules_followed: true, notes: "Best trade of the month, let it run to target." },
  { entry_date_offset: 40, instrument: "US30", asset_class: "Indices", strategy: "Mean reversion", session: "New York", emotion: "Anxious", direction: "short", entry_price: 35100, exit_price: 35240, size: 0.5, pnl: -140, r_multiple: -0.9, rules_followed: false, notes: "Faded strength in a strong uptrend, against the rules." },
  { entry_date_offset: 32, instrument: "EUR/USD", asset_class: "Forex", strategy: "Breakout", session: "London", emotion: "Confident", direction: "long", entry_price: 1.079, exit_price: 1.0835, size: 1.0, pnl: 450, r_multiple: 1.7, rules_followed: true, notes: "Same setup as trade one, repeatable edge." },
  { entry_date_offset: 24, instrument: "BTC/USD", asset_class: "Crypto", strategy: "Trend following", session: "Asia", emotion: "Calm", direction: "long", entry_price: 44500, exit_price: 45700, size: 0.2, pnl: 240, r_multiple: 1.9, rules_followed: true, notes: "Trailed stop through the move, exited on momentum loss." },
  { entry_date_offset: 15, instrument: "GBP/USD", asset_class: "Forex", strategy: "Mean reversion", session: "London", emotion: "Impatient", direction: "short", entry_price: 1.283, exit_price: 1.287, size: 1.0, pnl: -400, r_multiple: -2.0, rules_followed: false, notes: "Oversized after two wins, discipline slipped." },
  { entry_date_offset: 8, instrument: "US30", asset_class: "Indices", strategy: "Breakout", session: "New York", emotion: "Confident", direction: "long", entry_price: 35600, exit_price: 35810, size: 0.5, pnl: 210, r_multiple: 1.3, rules_followed: true, notes: "Opening range breakout, followed plan exactly." },
  { entry_date_offset: 3, instrument: "EUR/USD", asset_class: "Forex", strategy: "Trend following", session: "London", emotion: "Calm", direction: "long", entry_price: 1.087, exit_price: 1.091, size: 1.0, pnl: 400, r_multiple: 1.6, rules_followed: true, notes: "Continuation of the daily uptrend." },
];

function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function resetDemoData() {
  const { data: existing } = await supabase
    .from("trades")
    .select("screenshot_url")
    .eq("account_id", DEMO_ACCOUNT_ID)
    .not("screenshot_url", "is", null);

  if (existing && existing.length > 0) {
    await deleteScreenshotsByUrls(existing.map((t) => t.screenshot_url as string));
  }

  await supabase.from("trades").delete().eq("account_id", DEMO_ACCOUNT_ID);
  const rows = DEMO_TRADES.map((t) => ({
    account_id: DEMO_ACCOUNT_ID,
    entry_date: dateOffset(t.entry_date_offset),
    instrument: t.instrument,
    asset_class: t.asset_class,
    strategy: t.strategy,
    session: t.session,
    emotion: t.emotion,
    direction: t.direction,
    entry_price: t.entry_price,
    exit_price: t.exit_price,
    size: t.size,
    pnl: t.pnl,
    r_multiple: t.r_multiple,
    rules_followed: t.rules_followed,
    notes: t.notes,
  }));
  return supabase.from("trades").insert(rows);
}
