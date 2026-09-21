"""
Tests for backtest_core.py — run with:  python -m pytest scripts/backtest -q

Every test uses synthetic candles and never touches R2/Postgres/network;
that's the point of keeping backtest_core.py free of I/O.
"""

import datetime as dt
import json
import math

import backtrader as bt
import numpy as np
import pandas as pd
import pytest

import backtest_core as core


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def make_candles(n=400, start="2026-01-05", freq_min=15, seed=1):
    """Chart-ready candles in the app's {t,o,h,l,c} shape."""
    rng = np.random.default_rng(seed)
    close = 1.10 + np.cumsum(rng.normal(0, 0.0005, n))
    t0 = int(pd.Timestamp(start).timestamp())
    return [
        {"t": t0 + i * freq_min * 60, "o": float(close[i]), "h": float(close[i] + 0.0004), "l": float(close[i] - 0.0004), "c": float(close[i])}
        for i in range(n)
    ]


def df_for(candles):
    first = dt.datetime.utcfromtimestamp(candles[0]["t"])
    last = dt.datetime.utcfromtimestamp(candles[-1]["t"])
    return core.candles_to_dataframe(candles, first, last)


SMA_LONG_ONLY = """
import backtrader as bt
class S(bt.Strategy):
    def __init__(self):
        self.sma = bt.ind.SMA(self.data.close, period=10)
    def next(self):
        if not self.position and self.data.close[0] > self.sma[0]:
            self.buy(size=1000)
        elif self.position and self.data.close[0] < self.sma[0]:
            self.close()
"""

REVERSING = """
import backtrader as bt
class Rev(bt.Strategy):
    def __init__(self):
        self.sma = bt.ind.SMA(self.data.close, period=8)
    def next(self):
        up = self.data.close[0] > self.sma[0]
        if up and self.position.size <= 0:
            self.order_target_size(target=1000)
        elif not up and self.position.size >= 0:
            self.order_target_size(target=-1000)
"""


# ---------------------------------------------------------------------------
# candles_to_dataframe
# ---------------------------------------------------------------------------


class TestCandlesToDataframe:
    def test_shape_and_columns(self):
        c = make_candles(50)
        df = df_for(c)
        assert list(df.columns) == ["open", "high", "low", "close", "volume"]
        assert len(df) == 50
        assert (df["volume"] == 0).all()

    def test_sorted_ascending_even_if_input_unsorted(self):
        c = make_candles(20)
        shuffled = list(reversed(c))
        df = df_for(c) if False else core.candles_to_dataframe(
            shuffled, dt.datetime.utcfromtimestamp(c[0]["t"]), dt.datetime.utcfromtimestamp(c[-1]["t"])
        )
        assert df.index.is_monotonic_increasing

    def test_duplicates_collapse_keeping_last(self):
        c = make_candles(5)
        dup = c + [{**c[2], "c": 9.99}]  # same t as c[2], different close
        df = core.candles_to_dataframe(dup, dt.datetime.utcfromtimestamp(c[0]["t"]), dt.datetime.utcfromtimestamp(c[-1]["t"]))
        assert len(df) == 5
        assert df.iloc[2]["close"] == 9.99

    def test_range_filter_is_inclusive_both_ends(self):
        c = make_candles(10)
        start = dt.datetime.utcfromtimestamp(c[3]["t"])
        end = dt.datetime.utcfromtimestamp(c[6]["t"])
        df = core.candles_to_dataframe(c, start, end)
        assert len(df) == 4  # indices 3,4,5,6

    def test_empty_input_returns_empty_frame_with_columns(self):
        df = core.candles_to_dataframe([], dt.datetime(2026, 1, 1), dt.datetime(2026, 1, 2))
        assert df.empty
        assert list(df.columns) == ["open", "high", "low", "close", "volume"]

    def test_nothing_in_range_returns_empty(self):
        c = make_candles(10)
        df = core.candles_to_dataframe(c, dt.datetime(2030, 1, 1), dt.datetime(2030, 2, 1))
        assert df.empty

    def test_index_is_naive_utc(self):
        c = make_candles(3)
        df = df_for(c)
        assert df.index.tz is None
        assert df.index[0] == pd.Timestamp(dt.datetime.utcfromtimestamp(c[0]["t"]))


# ---------------------------------------------------------------------------
# sanitize_for_json
# ---------------------------------------------------------------------------


class TestSanitizeForJson:
    def test_nan_and_inf_become_null(self):
        out = core.sanitize_for_json({"a": float("nan"), "b": float("inf"), "c": float("-inf"), "d": 1.5})
        assert out == {"a": None, "b": None, "c": None, "d": 1.5}

    def test_result_is_strictly_valid_json(self):
        out = core.sanitize_for_json({"a": float("nan"), "b": [float("inf")]})
        # allow_nan=False raises on any NaN/Infinity that slipped through
        json.dumps(out, allow_nan=False)

    def test_datetime_and_date_keys_become_iso_strings(self):
        out = core.sanitize_for_json({dt.datetime(2026, 1, 31, 0, 0): 1.0, dt.date(2026, 2, 1): 2.0})
        assert out == {"2026-01-31T00:00:00": 1.0, "2026-02-01": 2.0}

    def test_nested_structures_and_ordered_dict(self):
        from collections import OrderedDict

        out = core.sanitize_for_json(OrderedDict(total=OrderedDict(closed=3, open=0), streak=(1, 2)))
        assert out == {"total": {"closed": 3, "open": 0}, "streak": [1, 2]}

    def test_numpy_scalars(self):
        out = core.sanitize_for_json({"a": np.float64(2.5), "b": np.int64(7), "c": np.float64("nan")})
        assert out == {"a": 2.5, "b": 7, "c": None}
        json.dumps(out, allow_nan=False)

    def test_none_bool_str_passthrough(self):
        assert core.sanitize_for_json({"a": None, "b": True, "c": "x"}) == {"a": None, "b": True, "c": "x"}

    def test_bool_is_not_coerced_to_int(self):
        # bool is a subclass of int in Python — make sure True stays True, not 1
        assert core.sanitize_for_json(True) is True

    def test_unserializable_object_falls_back_to_str(self):
        class Weird:
            def __str__(self):
                return "weird!"

        assert core.sanitize_for_json({"a": Weird()}) == {"a": "weird!"}


# ---------------------------------------------------------------------------
# load_strategy_class
# ---------------------------------------------------------------------------


class TestLoadStrategyClass:
    def test_loads_single_strategy(self):
        cls = core.load_strategy_class(SMA_LONG_ONLY)
        assert issubclass(cls, bt.Strategy) and cls.__name__ == "S"

    def test_no_strategy_raises_clear_error(self):
        with pytest.raises(core.StrategyLoadError, match="doesn't define"):
            core.load_strategy_class("x = 1")

    def test_two_strategies_raises_and_names_them(self):
        src = "import backtrader as bt\nclass A(bt.Strategy): pass\nclass B(bt.Strategy): pass\n"
        with pytest.raises(core.StrategyLoadError, match="more than one.*A, B"):
            core.load_strategy_class(src)

    def test_imported_base_strategy_is_ignored(self):
        # bt.Strategy itself is imported into the module namespace and must not count
        src = "import backtrader as bt\nfrom backtrader import Strategy\nclass Only(Strategy): pass\n"
        assert core.load_strategy_class(src).__name__ == "Only"

    def test_syntax_error_reports_line(self):
        with pytest.raises(core.StrategyLoadError, match="line 2"):
            core.load_strategy_class("import backtrader as bt\nclass Bad(bt.Strategy\n")

    def test_import_time_failure_is_wrapped(self):
        with pytest.raises(core.StrategyLoadError, match="ZeroDivisionError"):
            core.load_strategy_class("1/0")

    def test_missing_module_is_wrapped(self):
        with pytest.raises(core.StrategyLoadError, match="ModuleNotFoundError"):
            core.load_strategy_class("import definitely_not_a_real_module_xyz")


# ---------------------------------------------------------------------------
# run_backtest — trade recording
# ---------------------------------------------------------------------------


class TestRunBacktestTrades:
    def run(self, src, candles=None, tf="15min", inst="EURUSD"):
        candles = candles or make_candles(400)
        cls = core.load_strategy_class(src)
        return core.run_backtest(cls, [core.FeedSpec(instrument=inst, timeframe=tf, df=df_for(candles))])

    def test_records_trades_without_strategy_cooperation(self):
        # SMA_LONG_ONLY defines NO notify_trade — recorder must still work
        res = self.run(SMA_LONG_ONLY)
        assert len(res["trades"]) > 5

    def test_trade_fields_present_and_sane(self):
        res = self.run(SMA_LONG_ONLY)
        t = res["trades"][0]
        assert t["feed"] == "EURUSD_15min"
        assert t["direction"] == "long"
        assert t["size"] == 1000
        assert t["closed_at"] > t["opened_at"]
        assert isinstance(t["opened_at"], dt.datetime)

    def test_derived_exit_price_reproduces_pnl_for_longs(self):
        res = self.run(SMA_LONG_ONLY)
        for t in res["trades"]:
            expected_pnl = (t["exit_price"] - t["entry_price"]) * t["size"]
            assert t["pnl"] == pytest.approx(expected_pnl, abs=1e-9)

    def test_shorts_and_reversals_are_recorded_with_correct_direction_and_exit(self):
        res = self.run(REVERSING)
        dirs = {t["direction"] for t in res["trades"]}
        assert dirs == {"long", "short"}
        for t in res["trades"]:
            sign = 1 if t["direction"] == "long" else -1
            expected_pnl = (t["exit_price"] - t["entry_price"]) * t["size"] * sign
            assert t["pnl"] == pytest.approx(expected_pnl, abs=1e-9)

    def test_size_is_reported_positive_for_shorts(self):
        res = self.run(REVERSING)
        assert all(t["size"] > 0 for t in res["trades"])

    def test_open_trade_at_end_of_data_is_not_recorded(self):
        # Buys once and never closes: no CLOSED trade exists, so none is recorded.
        src = """
import backtrader as bt
class HoldForever(bt.Strategy):
    def next(self):
        if not self.position:
            self.buy(size=1000)
"""
        assert self.run(src)["trades"] == []

    def test_partial_scale_out_derived_exit_matches_pnl(self):
        # Opens 2000, closes in two 1000 pieces at different prices. The
        # trade closes only when fully flat; derived exit must still
        # reproduce total pnl (this is why we derive rather than remember
        # the last fill price).
        src = """
import backtrader as bt
class ScaleOut(bt.Strategy):
    def __init__(self):
        self.i = 0
    def next(self):
        self.i += 1
        if self.i == 3:
            self.buy(size=2000)
        elif self.i == 6:
            self.sell(size=1000)
        elif self.i == 9:
            self.sell(size=1000)
"""
        res = self.run(src)
        assert len(res["trades"]) == 1
        t = res["trades"][0]
        assert t["pnl"] == pytest.approx((t["exit_price"] - t["entry_price"]) * t["size"], abs=1e-9)

    def test_final_value_returned(self):
        res = self.run(SMA_LONG_ONLY)
        assert isinstance(res["final_value"], float)


# ---------------------------------------------------------------------------
# run_backtest — analyzers
# ---------------------------------------------------------------------------


class TestRunBacktestAnalysis:
    def run(self, src=SMA_LONG_ONLY):
        cls = core.load_strategy_class(src)
        return core.run_backtest(cls, [core.FeedSpec(instrument="EURUSD", timeframe="15min", df=df_for(make_candles(600)))])

    def test_all_declared_analyzers_present_in_order(self):
        res = self.run()
        assert list(res["analysis"].keys()) == [name for name, _, _ in core.ANALYZER_SPECS]

    def test_whole_analysis_blob_is_strict_json(self):
        res = self.run()
        json.dumps(res["analysis"], allow_nan=False)

    def test_trade_analyzer_reports_total_closed(self):
        res = self.run()
        assert res["analysis"]["TradeAnalyzer"]["total"]["closed"] == len(res["trades"])

    def test_zero_trade_run_still_serializes_cleanly(self):
        # Sharpe/SQN/Calmar produce None/NaN when there's nothing to measure —
        # the classic way to break a naive json.dumps.
        src = "import backtrader as bt\nclass Idle(bt.Strategy):\n    def next(self): pass\n"
        res = self.run(src)
        assert res["trades"] == []
        json.dumps(res["analysis"], allow_nan=False)

    def test_time_series_analyzers_are_not_attached(self):
        res = self.run()
        for heavy in ("GrossLeverage", "PositionsValue", "Transactions", "TimeReturn"):
            assert heavy not in res["analysis"]

    def test_recorder_not_leaked_into_analysis(self):
        assert "_TradeRecorder" not in self.run()["analysis"]


# ---------------------------------------------------------------------------
# run_backtest — multi-feed
# ---------------------------------------------------------------------------


class TestRunBacktestMultiFeed:
    MULTI = """
import backtrader as bt
class Multi(bt.Strategy):
    def __init__(self):
        self.fast = self.getdatabyname("EURUSD_15min")
        self.slow = self.getdatabyname("EURUSD_1h")
        self.other = self.getdatabyname("GBPUSD_15min")
        self.sma = bt.ind.SMA(self.fast.close, period=10)
    def next(self):
        if not self.getposition(self.fast) and self.fast.close[0] > self.sma[0]:
            self.buy(data=self.fast, size=1000)
        elif self.getposition(self.fast) and self.fast.close[0] < self.sma[0]:
            self.close(data=self.fast)
"""

    def test_multi_asset_multi_timeframe_feeds_addressable_by_name(self):
        cls = core.load_strategy_class(self.MULTI)
        feeds = [
            core.FeedSpec(instrument="EURUSD", timeframe="1h", df=df_for(make_candles(200, freq_min=60, seed=1))),
            core.FeedSpec(instrument="GBPUSD", timeframe="15min", df=df_for(make_candles(800, seed=2))),
            core.FeedSpec(instrument="EURUSD", timeframe="15min", df=df_for(make_candles(800, seed=1))),
        ]
        res = core.run_backtest(cls, feeds)
        assert len(res["trades"]) > 0
        assert {t["feed"] for t in res["trades"]} == {"EURUSD_15min"}

    def test_finest_timeframe_becomes_master_feed_regardless_of_input_order(self):
        src = """
import backtrader as bt
class Probe(bt.Strategy):
    def __init__(self):
        self.master_name = self.data._name
    def stop(self):
        MASTER.append(self.master_name)
MASTER = []
"""
        cls = core.load_strategy_class(src)
        feeds = [
            core.FeedSpec(instrument="EURUSD", timeframe="4h", df=df_for(make_candles(60, freq_min=240))),
            core.FeedSpec(instrument="EURUSD", timeframe="15min", df=df_for(make_candles(800))),
        ]
        core.run_backtest(cls, feeds)
        import sys

        assert sys.modules["uploaded_strategy"].MASTER == ["EURUSD_15min"]

    def test_no_feeds_raises(self):
        cls = core.load_strategy_class(SMA_LONG_ONLY)
        with pytest.raises(ValueError, match="No data feeds"):
            core.run_backtest(cls, [])

    def test_daily_timeframe_uses_days_timeframe(self):
        cls = core.load_strategy_class(SMA_LONG_ONLY)
        res = core.run_backtest(cls, [core.FeedSpec(instrument="EURUSD", timeframe="1day", df=df_for(make_candles(120, freq_min=1440)))])
        assert res["analysis"]["TradeAnalyzer"]["total"]["closed"] == len(res["trades"])


def test_feed_name_format():
    assert core.feed_name("XAUUSD", "1h") == "XAUUSD_1h"


def test_timeframe_table_matches_typescript_source_of_truth():
    # scripts/candleAggregation.ts TIMEFRAMES_MINUTES — if the TS side
    # ever adds/changes a timeframe, this catches the Python table drifting.
    import pathlib
    import re

    ts = (pathlib.Path(__file__).resolve().parents[1] / "candleAggregation.ts").read_text()
    block = re.search(r"TIMEFRAMES_MINUTES: Record<string, number> = \{(.*?)\};", ts, re.S).group(1)
    ts_table = {m.group(1): int(m.group(2)) for m in re.finditer(r'"([^"]+)":\s*(\d+)', block)}
    assert core.TIMEFRAME_MINUTES == ts_table
