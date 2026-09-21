"""
scripts/backtest/run_backtest.py

Entrypoint run by .github/workflows/backtest.yml, AFTER
scripts/sync-backtest-candles.ts has made sure every candle this run
needs is present in the backtest R2 bucket. This file is the thin I/O
shell around backtest_core.py (which holds all the testable logic):

    1. mark the run 'running'
    2. read the run's definition + uploaded script from Postgres
    3. read the needed candle month-files from the backtest R2 bucket
    4. run Backtrader (backtest_core.run_backtest)
    5. write backtest_trades + backtrader_analysis, mark 'completed'
    6. POST a completion webhook so the web app can react immediately

Every failure path marks the run 'failed' with a human-readable
error_message — a run that silently stays 'running' forever would leave
the UI polling indefinitely, which is the worst failure mode this file
could have. See main()'s outermost try/except.

Environment (all provided by the workflow):
    BACKTEST_RUN_ID          the backtest_runs.id to execute
    SUPABASE_DB_URL          Postgres connection string
    R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
    R2_BACKTEST_BUCKET_NAME  the exness-backtest-candles bucket
    WEBHOOK_URL              (optional) full URL of the app's completion webhook
    BACKTEST_WEBHOOK_SECRET  (optional) bearer secret for that webhook
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys
import traceback
from typing import Any

import boto3
import psycopg2
import psycopg2.extras
import requests
from botocore.exceptions import ClientError

import backtest_core as core

# The app stores every trade date/time in East Africa Time (UTC+3) — see
# lib/exnessImport.ts's EXNESS_TO_LOCAL_OFFSET_HOURS and
# lib/chartTradeWindow.ts's APP_LOCAL_OFFSET_HOURS. TradeChartModal turns a
# stored date/time back into UTC by SUBTRACTING this offset, so
# backtest_trades must be written with it ADDED, or every backtest
# trade's chart marker would land 3 hours off its candle. Backtest trades
# are shown on the same chart component as live ones, so they follow the
# same single convention rather than getting a UTC special case.
APP_LOCAL_OFFSET_HOURS = 3

# Error text is stored in a text column and shown in the UI; cap it so a
# pathological traceback can't bloat the row.
MAX_ERROR_LEN = 4000


# ---------------------------------------------------------------------------
# small pure helpers (unit tested in test_run_backtest.py)
# ---------------------------------------------------------------------------


def month_range(start: dt.date, end: dt.date) -> list[str]:
    """Every 'YYYY-MM' month from start's month through end's month, inclusive."""
    months: list[str] = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.append(f"{y}-{m:02d}")
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return months


def to_app_local(utc_naive: dt.datetime) -> tuple[str, str]:
    """
    Naive-UTC datetime -> the (date, time) strings the app stores, in its
    fixed UTC+3 convention (see APP_LOCAL_OFFSET_HOURS). Returns
    ('YYYY-MM-DD', 'HH:MM:SS').
    """
    local = utc_naive + dt.timedelta(hours=APP_LOCAL_OFFSET_HOURS)
    return local.strftime("%Y-%m-%d"), local.strftime("%H:%M:%S")


def split_feed_name(feed: str) -> tuple[str, str]:
    """'EURUSD_15min' -> ('EURUSD', '15min'). Timeframe names never contain '_', instruments might."""
    instrument, _, timeframe = feed.rpartition("_")
    return instrument, timeframe


def build_trade_rows(run_id: str, trades: list[dict[str, Any]]) -> list[tuple]:
    """
    Turns TradeRecorder output into rows for backtest_trades, in column
    order: (run_id, instrument, direction, entry_date, entry_time,
    exit_date, exit_time, entry_price, exit_price, size, pnl).
    """
    rows = []
    for t in trades:
        instrument, _ = split_feed_name(t["feed"])
        entry_date, entry_time = to_app_local(t["opened_at"])
        exit_date, exit_time = to_app_local(t["closed_at"])
        rows.append(
            (
                run_id,
                instrument,
                t["direction"],
                entry_date,
                entry_time,
                exit_date,
                exit_time,
                t["entry_price"],
                t["exit_price"],
                t["size"],
                t["pnl"],
            )
        )
    return rows


def truncate_error(message: str) -> str:
    return message if len(message) <= MAX_ERROR_LEN else message[: MAX_ERROR_LEN - 20] + "\n…[truncated]"


# ---------------------------------------------------------------------------
# R2
# ---------------------------------------------------------------------------


def make_s3():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def read_month_candles(s3, bucket: str, instrument: str, timeframe: str, month: str) -> list[dict]:
    """
    One candles/{instrument}/{timeframe}/{month}.json object, or [] if it
    doesn't exist (a month with no synced data — a weekend-only edge, a
    month before the instrument existed, or a still-open month — is not an
    error on its own; the caller reports a precise "no data" error only
    if the WHOLE range comes back empty). Key shape must match
    candleKey() in scripts/candleAggregation.ts.
    """
    key = f"candles/{instrument}/{timeframe}/{month}.json"
    try:
        body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404", "NotFound"):
            return []
        raise
    parsed = json.loads(body)
    return parsed if isinstance(parsed, list) else []


# ---------------------------------------------------------------------------
# Postgres
# ---------------------------------------------------------------------------


def set_status(conn, run_id: str, status: str, error: str | None = None) -> None:
    with conn.cursor() as cur:
        if status in ("completed", "failed"):
            cur.execute(
                "update backtest_runs set status = %s, error_message = %s, completed_at = now() where id = %s",
                (status, error, run_id),
            )
        else:
            cur.execute(
                "update backtest_runs set status = %s, error_message = null, completed_at = null where id = %s",
                (status, run_id),
            )
    conn.commit()


def save_results(conn, run_id: str, result: dict[str, Any]) -> int:
    """
    Persists trades + analysis and marks the run completed, in ONE
    transaction — so a crash between "wrote trades" and "wrote status"
    can never leave a run showing 'running' with half its results, or
    'completed' with none. Old backtest_trades for this run are deleted
    first, which is what makes a re-run of the same run id idempotent
    instead of doubling its trades.
    """
    rows = build_trade_rows(run_id, result["trades"])
    with conn.cursor() as cur:
        cur.execute("delete from backtest_trades where run_id = %s", (run_id,))
        if rows:
            psycopg2.extras.execute_values(
                cur,
                """insert into backtest_trades
                   (run_id, instrument, direction, entry_date, entry_time, exit_date, exit_time,
                    entry_price, exit_price, size, pnl) values %s""",
                rows,
                page_size=500,
            )
        cur.execute(
            """update backtest_runs
               set backtrader_analysis = %s, status = 'completed', error_message = null, completed_at = now()
               where id = %s""",
            (psycopg2.extras.Json(result["analysis"]), run_id),
        )
    conn.commit()
    return len(rows)


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------


def notify_webhook(run_id: str, status: str, error: str | None) -> None:
    """
    Best-effort completion callback. Postgres is the source of truth for a
    run's outcome and the UI polls it, so a failed webhook must NEVER
    change the run's result — it is logged and swallowed. The webhook
    exists so the app can react immediately (and is where any future
    notification/cache-invalidation hook belongs), not to carry data.
    """
    url = os.environ.get("WEBHOOK_URL")
    secret = os.environ.get("BACKTEST_WEBHOOK_SECRET")
    if not url or not secret:
        print("Webhook not configured (WEBHOOK_URL / BACKTEST_WEBHOOK_SECRET unset) — skipping; the UI will pick the result up by polling.")
        return
    try:
        res = requests.post(
            url,
            json={"run_id": run_id, "status": status, "error": error},
            headers={"Authorization": f"Bearer {secret}"},
            timeout=15,
        )
        print(f"Webhook responded {res.status_code}.")
        if not res.ok:
            print(f"::warning::Webhook returned {res.status_code}: {res.text[:300]}")
    except Exception as exc:  # network error, timeout, DNS...
        print(f"::warning::Webhook call failed ({type(exc).__name__}: {exc}) — result is still saved in the database.")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


class RunFailure(Exception):
    """An expected, user-explainable failure: its message goes straight to error_message."""


def execute(conn, s3, bucket: str, run_id: str) -> int:
    """Runs one backtest end to end; returns the number of trades saved. Raises RunFailure/Exception on failure."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "select script_filename, script_source, start_date, end_date from backtest_runs where id = %s",
            (run_id,),
        )
        run = cur.fetchone()
        if run is None:
            raise RunFailure(f"No backtest_runs row found for id {run_id}.")
        cur.execute("select distinct instrument, timeframe from backtest_run_feeds where run_id = %s order by instrument, timeframe", (run_id,))
        feed_defs = cur.fetchall()
    if not feed_defs:
        raise RunFailure("This run has no data feeds (instrument + timeframe pairs).")
    for f in feed_defs:
        if f["timeframe"] not in core.TIMEFRAME_MINUTES:
            raise RunFailure(f"Unsupported timeframe '{f['timeframe']}' for {f['instrument']}.")

    try:
        strategy_cls = core.load_strategy_class(run["script_source"], run["script_filename"])
    except core.StrategyLoadError as exc:
        raise RunFailure(str(exc)) from exc

    start_date, end_date = run["start_date"], run["end_date"]
    # Inclusive end DAY: candles on end_date itself are in range up to its last second.
    start_dt = dt.datetime.combine(start_date, dt.time.min)
    end_dt = dt.datetime.combine(end_date, dt.time.max)
    months = month_range(start_date, end_date)

    feeds: list[core.FeedSpec] = []
    for f in feed_defs:
        candles: list[dict] = []
        for month in months:
            candles.extend(read_month_candles(s3, bucket, f["instrument"], f["timeframe"], month))
        df = core.candles_to_dataframe(candles, start_dt, end_dt)
        if df.empty:
            raise RunFailure(
                f"No candle data found for {f['instrument']} {f['timeframe']} between {start_date} and {end_date}. "
                "The instrument may not exist in Exness's tick archive under that name, or the whole range may be "
                "in the future / not yet closed."
            )
        print(f"  {f['instrument']} {f['timeframe']}: {len(df):,} candles ({df.index[0]} → {df.index[-1]})")
        feeds.append(core.FeedSpec(instrument=f["instrument"], timeframe=f["timeframe"], df=df))

    print("Running Backtrader…")
    try:
        result = core.run_backtest(strategy_cls, feeds)
    except Exception as exc:
        # An exception raised INSIDE the user's strategy during the run —
        # surface its own traceback tail, which is what they need to debug.
        tb = traceback.format_exc()
        raise RunFailure(f"The strategy raised an error while running: {type(exc).__name__}: {exc}\n\n{tb[-1500:]}") from exc

    saved = save_results(conn, run_id, result)
    print(f"Saved {saved:,} trade(s). Final portfolio value: {result['final_value']:.2f}")
    return saved


def main() -> int:
    run_id = os.environ.get("BACKTEST_RUN_ID")
    if not run_id:
        print("::error::BACKTEST_RUN_ID is not set.")
        return 1

    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    status, error = "failed", None
    try:
        set_status(conn, run_id, "running")
        s3 = make_s3()
        execute(conn, s3, os.environ["R2_BACKTEST_BUCKET_NAME"], run_id)
        status = "completed"
    except RunFailure as exc:
        error = str(exc)
        print(f"::error::{error}")
    except Exception as exc:  # anything unexpected: still must not leave the run 'running'
        error = f"Unexpected error: {type(exc).__name__}: {exc}\n\n{traceback.format_exc()[-1500:]}"
        print(f"::error::{error}")

    if status == "failed":
        try:
            conn.rollback()  # discard any half-finished transaction before writing the failure
            set_status(conn, run_id, "failed", truncate_error(error or "Unknown error."))
        except Exception as exc:
            print(f"::error::Could not record the failure in the database: {exc}")
    conn.close()

    notify_webhook(run_id, status, error if status == "failed" else None)
    return 0 if status == "completed" else 1


if __name__ == "__main__":
    sys.exit(main())
