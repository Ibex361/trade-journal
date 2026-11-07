# Exness Standard Cent accounts

How the journal models a cent account, why, and how to keep it correct.

## The model

A cent account differs from a Standard account in two independent ways:

| | Standard | Cent |
|---|---|---|
| Lot size | 1 lot = standard contract (EURUSD 100,000) | 1 lot = 1/100 of that (EURUSD 1,000) |
| Money unit | account currency (USD) | US cents (USC), $1 = 100 USC |

Verified against a real cent order history (forex, gold, index; every
profit reproduced to within 0.1 USC):

    P&L (USC) = price move x lots x STANDARD contract size
              = price move x units x 100,   units = lots x standard x 0.01

All of this lives in `lib/accountUnits.ts` (the unit model) and
`lib/exnessContractSize.ts` (sizes). Nothing else hard-codes 0.01 or 100.

## Storage convention (native-unit storage)

- `accounts.account_type`: `'standard'` (default) or `'cent'`.
- `trades.pnl`, `accounts.starting_balance`, targets: the account's own
  unit — **USC for a cent account**, exactly as the broker reports.
- `trades.size`: true units of the instrument (lots x standard contract x 0.01).
- Prices: unchanged.
- **Cent and Standard accounts must be separate journal accounts.** The money
  scale differs 100x; mixing them would corrupt every total.

`calculatePnl(..., moneyScale)` takes the scale (1 or 100) from
`unitModel(account).moneyScale`. It assumes the instrument's quote currency is
the account's major currency (USD-quoted pairs on a USD/USC account).

## Symbols (source: Exness "Tick history" page)

| Suffix | Account type | Example |
|---|---|---|
| none | Pro (some Zero) | XAUUSD |
| `m` | Standard | XAUUSDm |
| `c` | Standard Cent | XAUUSDc |

The suffix is **lowercase and case-significant**: the tick archive and the R2
candle keys are case-sensitive. Never `.toUpperCase()` a symbol — use
`normalizeBrokerSymbol` (`lib/brokerSymbol.ts`). Suffix detection needs a
lowercase letter after an all-uppercase base, so real symbols ending in an
uppercase C (USTEC, ETHBTC) are not misread.

Journal instruments for a cent account are stored as exported (`XAUUSDc`).
Charts/sync use `archiveSymbolFor(instrument, accountType)`, so a cent trade
typed by hand as plain `XAUUSD` still charts the cent feed. Cent and plain
feeds are cached separately in R2 (`candles/XAUUSDc/...` vs `candles/XAUUSD/...`).

## Backtests

Backtests stay account-agnostic by design (raw Backtrader numbers, no account
link). The only cent-specific piece: feed instruments keep their case, so
`XAUUSDc` resolves to the cent price feed. Backtest P&L is in the feed's quote
currency (USD), not USC.

## Moving an existing account to Cent

1. Settings → Accounts → Edit → Account type: Cent (currency becomes USC;
   check the starting balance is in cents).
2. Settings → Import trades → Exness → choose the same CSV → **Update sizes of
   N already-imported trades**. Only `size` (and an empty `asset_class`) is
   rewritten; strategy, notes, tags, screenshots and P&L are untouched.

## Keeping it correct

- Contract sizes come from Exness' published specs (instrument pages +
  "Common trading terms" glossary), last checked 2026-11-07. Not fetched live.
  An unknown symbol falls back to 1 **and the import warns**; add a per-account
  override in Settings → Broker import (an override is the final units-per-lot,
  no cent factor applied on top).
- `lib/__tests__/exnessImport.test.ts` replays a real cent export and asserts
  every imported P&L matches price move x size x 100 — re-run it with a fresh
  export whenever Exness changes cent specs.
- Not supported: other cent currencies (EUC, GBC, ...) beyond the label; the
  100x scale is the same, but quote-currency conversion is not done.

## Migration

`supabase/migrations/026_accounts_account_type.sql` — run once in the Supabase
SQL editor. All existing accounts default to `'standard'` and behave as before.
