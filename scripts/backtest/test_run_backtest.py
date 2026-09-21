"""
Tests for run_backtest.py — run with:  python -m pytest scripts/backtest -q

Pure helpers are tested directly. execute()/main() are tested against
in-memory fakes for Postgres and R2, because the property that matters
most there — "every failure path ends in status='failed', never a run
stuck on 'running'" — is exactly the kind of thing that only shows up
when you drive the failure paths on purpose.
"""

import datetime as dt
import json
import os
import pathlib
import re
import subprocess

import numpy as np
import pandas as pd
import pytest
from botocore.exceptions import ClientError

import backtest_core as core
import run_backtest as rb

from test_backtest_core import SMA_LONG_ONLY, make_candles


# ---------------------------------------------------------------------------
# pure helpers
# ---------------------------------------------------------------------------


class TestMonthRange:
    def test_single_month(self):
        assert rb.month_range(dt.date(2026, 1, 5), dt.date(2026, 1, 20)) == ["2026-01"]

    def test_crosses_year_boundary(self):
        assert rb.month_range(dt.date(2025, 11, 30), dt.date(2026, 2, 1)) == ["2025-11", "2025-12", "2026-01", "2026-02"]

    def test_inclusive_of_both_end_months(self):
        assert rb.month_range(dt.date(2026, 3, 31), dt.date(2026, 5, 1)) == ["2026-03", "2026-04", "2026-05"]

    def test_start_after_end_is_empty(self):
        assert rb.month_range(dt.date(2026, 5, 1), dt.date(2026, 1, 1)) == []


class TestToAppLocal:
    def test_adds_three_hours(self):
        assert rb.to_app_local(dt.datetime(2026, 1, 5, 10, 15, 0)) == ("2026-01-05", "13:15:00")

    def test_rolls_over_midnight_to_next_local_date(self):
        # 22:30 UTC is 01:30 next day in UTC+3 — same edge lib/exnessImport.ts documents
        assert rb.to_app_local(dt.datetime(2026, 1, 5, 22, 30, 0)) == ("2026-01-06", "01:30:00")

    def test_rolls_over_month_and_year(self):
        assert rb.to_app_local(dt.datetime(2025, 12, 31, 21, 0, 0)) == ("2026-01-01", "00:00:00")

    def test_exact_inverse_of_typescript_tradeLocalToUtcSeconds(self):
        """
        The load-bearing cross-language guarantee: TradeChartModal calls
        tradeLocalToUtcSeconds(date, time) (subtract 3h) on whatever is
        stored in backtest_trades. If to_app_local ever drifts from that
        function, every backtest chart marker lands on the wrong candle
        — silently. So actually run the TS function on our output and
        require it to give back the original UTC instant.
        """
        node = pytest.importorskip("shutil").which("node")
        if not node:
            pytest.skip("node not available")
        repo = pathlib.Path(__file__).resolve().parents[2]
        samples = [
            dt.datetime(2026, 1, 5, 10, 15, 0),
            dt.datetime(2026, 1, 5, 22, 30, 0),
            dt.datetime(2025, 12, 31, 21, 0, 0),
            dt.datetime(2026, 7, 1, 0, 0, 0),
        ]
        pairs = [rb.to_app_local(s) for s in samples]
        script = f"""
        import {{ tradeLocalToUtcSeconds }} from {json.dumps(str(repo / "lib" / "chartTradeWindow.ts"))};
        const pairs = {json.dumps(pairs)};
        console.log(JSON.stringify(pairs.map(([d, t]) => tradeLocalToUtcSeconds(d, t))));
        """
        out = subprocess.run(
            [str(repo / "node_modules" / ".bin" / "tsx"), "-e", script],
            capture_output=True, text=True, cwd=repo, timeout=60,
        )
        assert out.returncode == 0, out.stderr
        got = json.loads(out.stdout.strip().splitlines()[-1])
        expected = [int(s.replace(tzinfo=dt.timezone.utc).timestamp()) for s in samples]
        assert got == expected


class TestSplitFeedName:
    def test_simple(self):
        assert rb.split_feed_name("EURUSD_15min") == ("EURUSD", "15min")

    def test_instrument_containing_underscore(self):
        assert rb.split_feed_name("BTC_USD_1h") == ("BTC_USD", "1h")

    def test_roundtrips_with_feed_name(self):
        assert rb.split_feed_name(core.feed_name("XAUUSD", "4h")) == ("XAUUSD", "4h")


class TestBuildTradeRows:
    def trade(self, **kw):
        base = dict(
            feed="EURUSD_15min", direction="short", size=1000.0, entry_price=1.1, exit_price=1.09,
            opened_at=dt.datetime(2026, 1, 5, 10, 0, 0), closed_at=dt.datetime(2026, 1, 5, 12, 30, 0), pnl=10.0,
        )
        base.update(kw)
        return base

    def test_row_shape_and_column_order(self):
        rows = rb.build_trade_rows("run-1", [self.trade()])
        assert rows == [("run-1", "EURUSD", "short", "2026-01-05", "13:00:00", "2026-01-05", "15:30:00", 1.1, 1.09, 1000.0, 10.0)]

    def test_empty(self):
        assert rb.build_trade_rows("run-1", []) == []

    def test_instrument_is_feed_minus_timeframe(self):
        assert rb.build_trade_rows("r", [self.trade(feed="GBPUSD_1h")])[0][1] == "GBPUSD"


def test_truncate_error():
    assert rb.truncate_error("short") == "short"
    long = "x" * 10_000
    out = rb.truncate_error(long)
    assert len(out) <= rb.MAX_ERROR_LEN and out.endswith("[truncated]")


# ---------------------------------------------------------------------------
# fakes
# ---------------------------------------------------------------------------


class FakeCursor:
    def __init__(self, db):
        self.db = db
        self._result = None

    def __enter__(self): return self
    def __exit__(self, *a): return False

    def execute(self, sql, params=None):
        sql_l = " ".join(sql.split()).lower()
        self.db.executed.append((sql_l, params))
        if sql_l.startswith("select script_filename"):
            self._result = self.db.run
        elif sql_l.startswith("select distinct instrument, timeframe"):
            self._result = self.db.feeds
        elif sql_l.startswith("update backtest_runs set status"):
            if "completed_at = now()" in sql_l:
                self.db.status, self.db.error = params[0], params[1]
            else:
                self.db.status, self.db.error = params[0], None
            self.db.status_history.append(self.db.status)
        elif sql_l.startswith("update backtest_runs set backtrader_analysis"):
            self.db.analysis = params[0].adapted if hasattr(params[0], "adapted") else params[0]
            self.db.status, self.db.error = "completed", None
            self.db.status_history.append("completed")
        elif sql_l.startswith("delete from backtest_trades"):
            self.db.deleted_trades_for.append(params[0])

    def fetchone(self):
        return self._result

    def fetchall(self):
        return self._result


class FakeConn:
    def __init__(self, run, feeds):
        self.run, self.feeds = run, feeds
        self.executed, self.status_history = [], []
        self.status = "pending"
        self.error = None
        self.analysis = None
        self.deleted_trades_for = []
        self.inserted_rows = []
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self, cursor_factory=None):
        return FakeCursor(self)

    def commit(self): self.commits += 1
    def rollback(self): self.rollbacks += 1
    def close(self): self.closed = True


class FakeS3:
    def __init__(self, objects):
        self.objects = objects  # key -> list[candle dict]

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        payload = json.dumps(self.objects[Key]).encode()

        class Body:
            def read(self_inner): return payload

        return {"Body": Body()}


def base_run(source=SMA_LONG_ONLY, start=dt.date(2026, 1, 5), end=dt.date(2026, 1, 12)):
    return {"script_filename": "s.py", "script_source": source, "start_date": start, "end_date": end}


def eurusd_objects():
    # 400 15min candles from 2026-01-05 00:00 UTC ~ 4.2 days, all in Jan
    return {"candles/EURUSD/15min/2026-01.json": make_candles(400)}


@pytest.fixture(autouse=True)
def patch_execute_values(monkeypatch):
    """psycopg2.extras.execute_values needs a real cursor; capture rows instead."""
    def fake(cur, sql, rows, page_size=100):
        cur.db.inserted_rows.extend(rows)
    monkeypatch.setattr(rb.psycopg2.extras, "execute_values", fake)


# ---------------------------------------------------------------------------
# read_month_candles
# ---------------------------------------------------------------------------


class TestReadMonthCandles:
    def test_returns_candles_when_present(self):
        s3 = FakeS3({"candles/EURUSD/15min/2026-01.json": [{"t": 1, "o": 1, "h": 1, "l": 1, "c": 1}]})
        assert len(rb.read_month_candles(s3, "b", "EURUSD", "15min", "2026-01")) == 1

    def test_missing_month_is_empty_not_error(self):
        assert rb.read_month_candles(FakeS3({}), "b", "EURUSD", "15min", "2026-01") == []

    def test_other_client_errors_propagate(self):
        class Boom:
            def get_object(self, **kw):
                raise ClientError({"Error": {"Code": "AccessDenied"}}, "GetObject")

        with pytest.raises(ClientError):
            rb.read_month_candles(Boom(), "b", "EURUSD", "15min", "2026-01")

    def test_non_list_payload_is_empty(self):
        s3 = FakeS3({"candles/EURUSD/15min/2026-01.json": {"oops": 1}})
        assert rb.read_month_candles(s3, "b", "EURUSD", "15min", "2026-01") == []

    def test_key_matches_typescript_candleKey(self):
        ts = (pathlib.Path(__file__).resolve().parents[1] / "candleAggregation.ts").read_text()
        assert "`candles/${instrument}/${timeframe}/${month}.json`" in ts
        seen = []

        class Spy:
            def get_object(self, Bucket, Key):
                seen.append(Key)
                raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        rb.read_month_candles(Spy(), "b", "XAUUSD", "1h", "2026-03")
        assert seen == ["candles/XAUUSD/1h/2026-03.json"]


# ---------------------------------------------------------------------------
# execute — happy path
# ---------------------------------------------------------------------------


class TestExecuteHappyPath:
    def test_completes_and_saves_trades_and_analysis(self):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        saved = rb.execute(conn, FakeS3(eurusd_objects()), "bucket", "run-1")
        assert saved > 0
        assert conn.status == "completed"
        assert len(conn.inserted_rows) == saved
        assert conn.analysis is not None and "TradeAnalyzer" in conn.analysis
        assert conn.commits >= 1

    def test_old_trades_deleted_first_for_idempotent_rerun(self):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        rb.execute(conn, FakeS3(eurusd_objects()), "bucket", "run-9")
        assert conn.deleted_trades_for == ["run-9"]

    def test_inserted_rows_use_app_local_time(self):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        rb.execute(conn, FakeS3(eurusd_objects()), "bucket", "run-1")
        first = conn.inserted_rows[0]
        # first candle is 2026-01-05 00:00 UTC; local (UTC+3) times are >= 03:00 on that date
        assert first[3] == "2026-01-05" and first[4] >= "03:00:00"

    def test_multi_month_range_reads_every_month(self):
        seen = []
        class Spy(FakeS3):
            def get_object(self, Bucket, Key):
                seen.append(Key)
                return super().get_object(Bucket, Key)
        objs = eurusd_objects()
        conn = FakeConn(base_run(start=dt.date(2025, 12, 20), end=dt.date(2026, 2, 3)), [{"instrument": "EURUSD", "timeframe": "15min"}])
        rb.execute(conn, Spy(objs), "bucket", "r")
        assert seen == [f"candles/EURUSD/15min/{m}.json" for m in ("2025-12", "2026-01", "2026-02")]

    def test_end_date_is_inclusive_through_end_of_day(self):
        # candles run 2026-01-05 00:00 .. ~2026-01-09 04:00; end_date = 01-09 must include 01-09's candles
        conn = FakeConn(base_run(end=dt.date(2026, 1, 9)), [{"instrument": "EURUSD", "timeframe": "15min"}])
        captured = {}
        orig = core.run_backtest
        def spy(cls, feeds, **kw):
            captured["last"] = feeds[0]["df"].index[-1]
            return orig(cls, feeds, **kw)
        core.run_backtest, _ = spy, None
        try:
            rb.execute(conn, FakeS3(eurusd_objects()), "bucket", "r")
        finally:
            core.run_backtest = orig
        assert captured["last"].date() == dt.date(2026, 1, 9)


# ---------------------------------------------------------------------------
# execute — every expected failure is a RunFailure with a useful message
# ---------------------------------------------------------------------------


class TestExecuteFailures:
    def test_missing_run_row(self):
        conn = FakeConn(None, [])
        with pytest.raises(rb.RunFailure, match="No backtest_runs row"):
            rb.execute(conn, FakeS3({}), "b", "nope")

    def test_no_feeds(self):
        with pytest.raises(rb.RunFailure, match="no data feeds"):
            rb.execute(FakeConn(base_run(), []), FakeS3({}), "b", "r")

    def test_unsupported_timeframe(self):
        with pytest.raises(rb.RunFailure, match="Unsupported timeframe '3min'"):
            rb.execute(FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "3min"}]), FakeS3({}), "b", "r")

    def test_bad_script_syntax(self):
        conn = FakeConn(base_run(source="class ("), [{"instrument": "EURUSD", "timeframe": "15min"}])
        with pytest.raises(rb.RunFailure, match="Syntax error"):
            rb.execute(conn, FakeS3(eurusd_objects()), "b", "r")

    def test_script_without_strategy(self):
        conn = FakeConn(base_run(source="x = 1"), [{"instrument": "EURUSD", "timeframe": "15min"}])
        with pytest.raises(rb.RunFailure, match="doesn't define"):
            rb.execute(conn, FakeS3(eurusd_objects()), "b", "r")

    def test_no_candles_names_instrument_and_range(self):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        with pytest.raises(rb.RunFailure, match=r"No candle data found for EURUSD 15min between 2026-01-05 and 2026-01-12"):
            rb.execute(conn, FakeS3({}), "b", "r")

    def test_one_missing_feed_among_several_fails_the_run_naming_it(self):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}, {"instrument": "GBPUSD", "timeframe": "15min"}])
        with pytest.raises(rb.RunFailure, match="GBPUSD 15min"):
            rb.execute(conn, FakeS3(eurusd_objects()), "b", "r")

    def test_exception_inside_strategy_next_is_wrapped_with_traceback(self):
        src = "import backtrader as bt\nclass Bad(bt.Strategy):\n    def next(self):\n        raise RuntimeError('boom in next')\n"
        conn = FakeConn(base_run(source=src), [{"instrument": "EURUSD", "timeframe": "15min"}])
        with pytest.raises(rb.RunFailure, match="RuntimeError: boom in next"):
            rb.execute(conn, FakeS3(eurusd_objects()), "b", "r")
        assert conn.status != "completed"


# ---------------------------------------------------------------------------
# main — the "never stuck on running" guarantee
# ---------------------------------------------------------------------------


@pytest.fixture
def env(monkeypatch):
    for k, v in {
        "BACKTEST_RUN_ID": "run-1", "SUPABASE_DB_URL": "postgres://x", "R2_ACCOUNT_ID": "a",
        "R2_ACCESS_KEY_ID": "k", "R2_SECRET_ACCESS_KEY": "s", "R2_BACKTEST_BUCKET_NAME": "bkt",
    }.items():
        monkeypatch.setenv(k, v)
    monkeypatch.delenv("WEBHOOK_URL", raising=False)
    monkeypatch.delenv("BACKTEST_WEBHOOK_SECRET", raising=False)


def wire(monkeypatch, conn, s3):
    monkeypatch.setattr(rb.psycopg2, "connect", lambda url: conn)
    monkeypatch.setattr(rb, "make_s3", lambda: s3)


class TestMain:
    def test_success_transitions_running_then_completed(self, env, monkeypatch):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        wire(monkeypatch, conn, FakeS3(eurusd_objects()))
        assert rb.main() == 0
        assert conn.status_history == ["running", "completed"]
        assert conn.closed

    def test_expected_failure_ends_in_failed_with_message(self, env, monkeypatch):
        conn = FakeConn(base_run(source="x = 1"), [{"instrument": "EURUSD", "timeframe": "15min"}])
        wire(monkeypatch, conn, FakeS3(eurusd_objects()))
        assert rb.main() == 1
        assert conn.status == "failed"
        assert "doesn't define" in conn.error
        assert conn.rollbacks >= 1  # half-finished transaction discarded before writing the failure

    def test_unexpected_exception_still_ends_in_failed_not_running(self, env, monkeypatch):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        class ExplodingS3:
            def get_object(self, **kw):
                raise ConnectionError("R2 unreachable")
        wire(monkeypatch, conn, ExplodingS3())
        assert rb.main() == 1
        assert conn.status == "failed"
        assert "Unexpected error" in conn.error and "R2 unreachable" in conn.error

    def test_missing_run_id_env_fails_fast(self, env, monkeypatch):
        monkeypatch.delenv("BACKTEST_RUN_ID")
        assert rb.main() == 1

    def test_webhook_called_with_bearer_secret_on_success(self, env, monkeypatch):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        wire(monkeypatch, conn, FakeS3(eurusd_objects()))
        monkeypatch.setenv("WEBHOOK_URL", "https://app.example/api/backtests/webhook")
        monkeypatch.setenv("BACKTEST_WEBHOOK_SECRET", "shh")
        calls = []
        class Resp:
            status_code, ok, text = 200, True, ""
        monkeypatch.setattr(rb.requests, "post", lambda url, **kw: calls.append((url, kw)) or Resp())
        assert rb.main() == 0
        url, kw = calls[0]
        assert url == "https://app.example/api/backtests/webhook"
        assert kw["headers"] == {"Authorization": "Bearer shh"}
        assert kw["json"] == {"run_id": "run-1", "status": "completed", "error": None}

    def test_webhook_carries_failure_error(self, env, monkeypatch):
        conn = FakeConn(base_run(source="x = 1"), [{"instrument": "EURUSD", "timeframe": "15min"}])
        wire(monkeypatch, conn, FakeS3(eurusd_objects()))
        monkeypatch.setenv("WEBHOOK_URL", "https://app.example/w")
        monkeypatch.setenv("BACKTEST_WEBHOOK_SECRET", "shh")
        calls = []
        class Resp:
            status_code, ok, text = 200, True, ""
        monkeypatch.setattr(rb.requests, "post", lambda url, **kw: calls.append(kw) or Resp())
        rb.main()
        assert calls[0]["json"]["status"] == "failed" and "doesn't define" in calls[0]["json"]["error"]

    def test_webhook_network_failure_never_changes_outcome(self, env, monkeypatch):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        wire(monkeypatch, conn, FakeS3(eurusd_objects()))
        monkeypatch.setenv("WEBHOOK_URL", "https://app.example/w")
        monkeypatch.setenv("BACKTEST_WEBHOOK_SECRET", "shh")
        def boom(*a, **k): raise ConnectionError("nope")
        monkeypatch.setattr(rb.requests, "post", boom)
        assert rb.main() == 0            # run still succeeded
        assert conn.status == "completed"

    def test_webhook_skipped_when_unconfigured(self, env, monkeypatch, capsys):
        conn = FakeConn(base_run(), [{"instrument": "EURUSD", "timeframe": "15min"}])
        wire(monkeypatch, conn, FakeS3(eurusd_objects()))
        assert rb.main() == 0
        assert "Webhook not configured" in capsys.readouterr().out
