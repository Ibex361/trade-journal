"""
scripts/backtest/backtest_core.py

Pure logic for running a Backtrader backtest — deliberately free of any
network, R2, or Postgres access so it can be unit tested with synthetic
data (see test_backtest_core.py). run_backtest.py is the thin I/O shell
around this: it fetches the run definition and candles, hands them here,
and persists whatever comes back.

Four responsibilities live here:

  1. candles_to_dataframe  — turns the app's chart-ready candle shape
     ({t,o,h,l,c} rows, epoch seconds) into the OHLCV DataFrame
     Backtrader's PandasData feed wants.
  2. TradeRecorder         — a Backtrader *Analyzer* that records every
     closed trade independently of the uploaded strategy's own code.
  3. sanitize_for_json     — makes an analyzer's get_analysis() output
     storable as Postgres jsonb (see its docstring for why this is
     needed and non-obvious).
  4. load_strategy_class / run_backtest — load the uploaded script,
     wire up feeds + analyzers, run, and return plain-Python results.

TIME CONVENTION: every timestamp in this file is UTC. Candle files in R2
are UTC epoch seconds, Backtrader runs on naive datetimes that we
construct as UTC, and trade entry/exit timestamps come back out as UTC.
The webapp's chart converts backtest trade times the same way it handles
live trades' UTC-based chart window — see the trade-row builder in
run_backtest.py for how backtest_trades' date/time columns are filled.
"""

from __future__ import annotations

import datetime as dt
import importlib.util
import inspect
import math
import sys
import types
from typing import Any, Iterable

import backtrader as bt
import pandas as pd

# ---------------------------------------------------------------------------
# Timeframes
# ---------------------------------------------------------------------------

# Mirrors scripts/candleAggregation.ts's TIMEFRAMES_MINUTES exactly — the
# candle files in R2 are keyed by these same names, and the web app's
# form offers this same set. Kept as one table here so a timeframe name
# is validated in exactly one place on the Python side.
TIMEFRAME_MINUTES: dict[str, int] = {
    "1min": 1,
    "5min": 5,
    "15min": 15,
    "1h": 60,
    "4h": 240,
    "1day": 1440,
}


def feed_name(instrument: str, timeframe: str) -> str:
    """
    The name a strategy uses to look a feed up, e.g. "EURUSD_15min".
    Documented in the New Backtest form, since strategy authors need it:
    `self.getdatabyname("EURUSD_15min")`.
    """
    return f"{instrument}_{timeframe}"


# ---------------------------------------------------------------------------
# 1. Candles -> DataFrame
# ---------------------------------------------------------------------------


def candles_to_dataframe(
    candles: Iterable[dict[str, float]],
    start: dt.datetime,
    end: dt.datetime,
) -> pd.DataFrame:
    """
    Converts chart-ready candles ({"t": epoch_s, "o", "h", "l", "c"}) into
    the OHLCV DataFrame Backtrader's PandasData expects, restricted to
    [start, end] (both naive UTC datetimes, inclusive).

    - Sorted ascending and de-duplicated by timestamp (a month file that
      was merged across several sync runs is already de-duplicated by
      mergeCandles, but Backtrader raises on out-of-order or repeated
      bars, so this is a cheap belt-and-braces guarantee).
    - `volume` is a constant 0: the Exness tick archives carry bid/ask
      only, no volume, and the candles are built from bid alone (see
      aggregateTicksToAllTimeframes). Strategies that need volume can't
      get it from this data source; a constant column just keeps
      PandasData's expected column set satisfied.
    - Returns an empty DataFrame (with the right columns) when nothing
      falls inside the range, so the caller can report a precise
      "no data for X" error instead of crashing inside Backtrader.
    """
    rows = [c for c in candles if isinstance(c, dict) and "t" in c]
    columns = ["open", "high", "low", "close", "volume"]
    if not rows:
        return pd.DataFrame(columns=columns, index=pd.DatetimeIndex([], name="datetime"))

    df = pd.DataFrame(rows)
    df = df.drop_duplicates(subset="t", keep="last").sort_values("t")
    # Naive UTC index — Backtrader works in naive datetimes, and treating
    # them as UTC throughout is what keeps trade timestamps unambiguous.
    df["datetime"] = pd.to_datetime(df["t"], unit="s")
    df = df.set_index("datetime")
    df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close"})
    df["volume"] = 0.0
    df = df[columns]
    return df.loc[(df.index >= pd.Timestamp(start)) & (df.index <= pd.Timestamp(end))]


# ---------------------------------------------------------------------------
# 2. Trade recording (strategy-independent)
# ---------------------------------------------------------------------------


class TradeRecorder(bt.Analyzer):
    """
    Records every CLOSED trade, without any cooperation from the uploaded
    strategy.

    Why an Analyzer and not a hook in the strategy: the user's script
    defines its own strategy class, and may or may not override
    notify_trade — we can't make it call into a base method. But
    Backtrader delivers notify_order/notify_trade to every attached
    analyzer automatically, regardless of what the strategy does, so an
    Analyzer sees every trade for free.

    What a Backtrader `Trade` gives us, verified empirically against
    backtrader 1.9.78 rather than assumed:
      - At the moment a trade OPENS (trade.isopen): the signed size
        (negative = short), entry price (trade.price), open time
        (trade.dtopen), and the data feed it belongs to.
      - At the moment it CLOSES (trade.isclosed): pnl / pnlcomm and
        close time (trade.dtclose) — but size has already been zeroed,
        and there is NO exit price on the object at all.
    So entry-side facts are captured at open, and the exit price is
    DERIVED from the definition of gross P&L (pnl = (exit - entry) * size,
    signed size), i.e. exit = entry + pnl / size. That's exact for any
    number of partial fills, unlike "remember the last fill price", which
    would silently be wrong for a strategy that scales out in pieces.
    """

    def start(self) -> None:
        self._open: dict[int, dict[str, Any]] = {}
        self.trades: list[dict[str, Any]] = []

    def notify_trade(self, trade: bt.Trade) -> None:
        if trade.isopen and trade.ref not in self._open:
            self._open[trade.ref] = {
                "feed": trade.data._name,
                "size": float(trade.size),
                "entry_price": float(trade.price),
                "opened_at": bt.num2date(trade.dtopen),
            }
        elif trade.isclosed:
            opened = self._open.pop(trade.ref, None)
            if opened is None or opened["size"] == 0:
                # A trade we never saw open (shouldn't happen) or a
                # zero-size open (can't derive an exit price) — skip
                # rather than record a row with invented numbers.
                return
            pnl = float(trade.pnlcomm)  # net of commission; == pnl when no commission is configured
            gross = float(trade.pnl)
            exit_price = opened["entry_price"] + gross / opened["size"]
            self.trades.append(
                {
                    "feed": opened["feed"],
                    "direction": "long" if opened["size"] > 0 else "short",
                    "size": abs(opened["size"]),
                    "entry_price": opened["entry_price"],
                    "exit_price": exit_price,
                    "opened_at": opened["opened_at"],
                    "closed_at": bt.num2date(trade.dtclose),
                    "pnl": pnl,
                }
            )

    def get_analysis(self) -> list[dict[str, Any]]:
        return self.trades


# ---------------------------------------------------------------------------
# 3. Serializing analyzer output for Postgres jsonb
# ---------------------------------------------------------------------------


def sanitize_for_json(value: Any) -> Any:
    """
    Recursively converts an analyzer's get_analysis() result into
    something Postgres jsonb (and a browser's JSON.parse) will accept.
    Two Backtrader behaviors make this necessary, both confirmed
    empirically:

      1. Several analyzers (Calmar, TimeReturn, ...) return dicts KEYED
         BY datetime/date objects. json.dumps rejects non-string keys
         outright (except int/float/bool/None).
      2. json.dumps happily emits NaN and Infinity for float nan/inf —
         which are NOT valid JSON. Postgres jsonb rejects them, and
         JSON.parse in the browser throws. Sharpe, SQN and Calmar all
         legitimately produce None/NaN on a run with too few trades.

    So: datetime/date keys -> ISO strings; nan/inf -> null; every other
    key -> str(); tuples/sets -> lists; anything else non-serializable
    (a stray object) -> str(). Analyzer output is a display payload, so
    a lossy-but-valid conversion is the right tradeoff versus failing
    the whole run over one exotic value.
    """
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    if isinstance(value, dict):  # includes OrderedDict / AutoOrderedDict
        return {_sanitize_key(k): sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [sanitize_for_json(v) for v in value]
    # numpy scalars and other number-likes expose .item()
    item = getattr(value, "item", None)
    if callable(item):
        try:
            return sanitize_for_json(item())
        except Exception:
            pass
    return str(value)


def _sanitize_key(key: Any) -> str:
    if isinstance(key, (dt.datetime, dt.date)):
        return key.isoformat()
    return str(key)


# ---------------------------------------------------------------------------
# 4. Loading the uploaded strategy + running
# ---------------------------------------------------------------------------


class StrategyLoadError(Exception):
    """The uploaded script couldn't be turned into exactly one usable bt.Strategy."""


def load_strategy_class(source: str, filename: str = "strategy.py") -> type[bt.Strategy]:
    """
    Executes the uploaded script's source as a module and returns the
    bt.Strategy subclass it defines.

    Contract for uploaded scripts (shown to the user on the New Backtest
    form): define exactly one bt.Strategy subclass at module level.
    Subclasses merely *imported* into the module (e.g. `from
    somewhere import Base`) are ignored — only classes whose __module__
    is this script count — so a script can safely subclass an imported
    helper strategy without tripping the "more than one" check.

    Executed with no sandboxing by explicit user decision (single-user
    app, user feeds only their own trusted code — see the design
    discussion in the project memory). This is `exec` of the user's own
    file inside a CI runner, not an untrusted-input execution surface.
    """
    module = types.ModuleType("uploaded_strategy")
    module.__file__ = filename
    # Registered so `inspect`/pickling/`super()` lookups inside the script
    # can resolve its own module by name.
    sys.modules["uploaded_strategy"] = module
    try:
        code = compile(source, filename, "exec")
        exec(code, module.__dict__)  # noqa: S102 — see docstring
    except SyntaxError as exc:
        raise StrategyLoadError(f"Syntax error in {filename}, line {exc.lineno}: {exc.msg}") from exc
    except Exception as exc:  # the script's own import-time failure
        raise StrategyLoadError(f"{filename} failed while loading: {type(exc).__name__}: {exc}") from exc

    found = [
        obj
        for _, obj in inspect.getmembers(module, inspect.isclass)
        if issubclass(obj, bt.Strategy) and obj is not bt.Strategy and obj.__module__ == module.__name__
    ]
    if not found:
        raise StrategyLoadError(f"{filename} doesn't define a backtrader Strategy subclass (a class deriving from bt.Strategy).")
    if len(found) > 1:
        names = ", ".join(sorted(c.__name__ for c in found))
        raise StrategyLoadError(f"{filename} defines more than one Strategy subclass ({names}); define exactly one.")
    return found[0]


# The analyzers attached to every run, in display order. Chosen as the
# summary-level ones whose get_analysis() is a compact scalar-ish dict.
# Deliberately NOT attached: GrossLeverage, PositionsValue and
# Transactions — those are per-bar / per-fill time series (megabytes for
# a multi-year multi-feed run, useless as a jsonb "metrics panel"), and
# the per-trade detail they'd carry is already stored, richer, in
# backtest_trades. PyFolio is skipped too (needs pyfolio + pandas
# internals, and its output is arrays of returns/positions, not
# summary metrics).
#
# (name, class, kwargs). `name` becomes the top-level key in the stored
# backtrader_analysis blob, so it is also what the run detail page
# labels each section with.
ANALYZER_SPECS: list[tuple[str, type[bt.Analyzer], dict[str, Any]]] = [
    ("TradeAnalyzer", bt.analyzers.TradeAnalyzer, {}),
    ("DrawDown", bt.analyzers.DrawDown, {}),
    ("TimeDrawDown", bt.analyzers.TimeDrawDown, {}),
    ("Returns", bt.analyzers.Returns, {}),
    ("AnnualReturn", bt.analyzers.AnnualReturn, {}),
    # Sharpe on DAILY returns, the conventional basis; riskfreerate 0
    # because there's no obvious "right" rate for an FX/CFD backtest
    # and 0 keeps the number a pure return/volatility ratio.
    ("SharpeRatio", bt.analyzers.SharpeRatio, {"timeframe": bt.TimeFrame.Days, "riskfreerate": 0.0, "annualize": True}),
    ("SQN", bt.analyzers.SQN, {}),
    ("VWR", bt.analyzers.VWR, {}),
    ("Calmar", bt.analyzers.Calmar, {}),
]


class FeedSpec(dict):
    """{'instrument': str, 'timeframe': str, 'df': DataFrame} — a plain dict subclass for readability."""


def run_backtest(
    strategy_cls: type[bt.Strategy],
    feeds: list[FeedSpec],
    starting_cash: float = 10_000.0,
) -> dict[str, Any]:
    """
    Runs one backtest and returns plain-Python results:

        {
          "analysis": {AnalyzerName: sanitized get_analysis() output, ...},
          "trades":   [ {feed, direction, size, entry_price, exit_price,
                         opened_at, closed_at, pnl}, ... ],
          "final_value": float,
        }

    Feed ordering matters to Backtrader: the FIRST added feed is the
    "master" clock (self.data / self.datas[0]) that drives next(), and
    slower-timeframe feeds must come after faster ones or Backtrader
    can't line them up. So feeds are added finest-timeframe-first
    (stable within a timeframe, preserving the order the user declared
    instruments in) — a strategy always sees its finest feed as
    self.data, with coarser ones addressable by name (feed_name()).
    """
    if not feeds:
        raise ValueError("No data feeds to run.")

    # Default stdstats (broker/trades/buysell observers) deliberately LEFT ON.
    # An earlier version passed stdstats=False as a speed-up, but
    # AnnualReturn reads self.strategy.stats.broker — the broker observer
    # stdstats=False removes — and crashed every run at stop(). The tests
    # caught it. Don't "optimize" this back without checking every
    # analyzer in ANALYZER_SPECS for observer dependencies first.
    cerebro = bt.Cerebro()
    for feed in sorted(feeds, key=lambda f: TIMEFRAME_MINUTES[f["timeframe"]]):
        minutes = TIMEFRAME_MINUTES[feed["timeframe"]]
        if minutes >= 1440:
            tf, compression = bt.TimeFrame.Days, 1
        else:
            tf, compression = bt.TimeFrame.Minutes, minutes
        cerebro.adddata(
            bt.feeds.PandasData(dataname=feed["df"], name=feed_name(feed["instrument"], feed["timeframe"]), timeframe=tf, compression=compression)
        )

    cerebro.addstrategy(strategy_cls)
    cerebro.broker.setcash(starting_cash)
    for name, cls, kwargs in ANALYZER_SPECS:
        cerebro.addanalyzer(cls, _name=name, **kwargs)
    cerebro.addanalyzer(TradeRecorder, _name="_TradeRecorder")

    strat = cerebro.run()[0]

    analysis: dict[str, Any] = {}
    for name, _, _ in ANALYZER_SPECS:
        try:
            analysis[name] = sanitize_for_json(getattr(strat.analyzers, name).get_analysis())
        except Exception as exc:  # one analyzer failing must not sink the whole run
            analysis[name] = {"error": f"{type(exc).__name__}: {exc}"}

    return {
        "analysis": analysis,
        "trades": strat.analyzers._TradeRecorder.get_analysis(),
        "final_value": float(cerebro.broker.getvalue()),
    }
