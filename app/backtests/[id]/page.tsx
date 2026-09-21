"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Card from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";
import StatusBadge from "@/components/backtests/StatusBadge";
import BacktraderResults from "@/components/backtests/BacktraderResults";
import BacktestTradesTable from "@/components/backtests/BacktestTradesTable";
import { useInterval } from "@/hooks/useInterval";
import { isUuid } from "@/lib/backtestValidation";
import { reportedClosedTrades } from "@/lib/backtestAnalysis";
import {
  fetchBacktestFeeds,
  fetchBacktestRun,
  fetchBacktestTrades,
  type BacktestFeed,
  type BacktestRun,
  type BacktestTrade,
} from "@/lib/backtests";
import { formatDuration, formatRunDate, isStale, pollDelayFor } from "@/lib/backtestFormat";

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error"; message: string }
  | { kind: "ready"; run: BacktestRun };

export default function BacktestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const validId = isUuid(id);

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [feeds, setFeeds] = useState<BacktestFeed[]>([]);
  const [trades, setTrades] = useState<BacktestTrade[] | null>(null);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const loadRun = useCallback(async () => {
    if (!validId) return;
    const { data, error } = await fetchBacktestRun(id);
    if (error) {
      // A transient failure while polling an already-loaded run keeps the
      // last good data on screen instead of replacing it with an error.
      setState((cur) => (cur.kind === "ready" ? cur : { kind: "error", message: error.message }));
      return;
    }
    if (!data) {
      setState({ kind: "notfound" });
      return;
    }
    setState({ kind: "ready", run: data as BacktestRun });
    setNowMs(Date.now());
  }, [id, validId]);

  // Initial load: the run, and its feeds (feeds never change after creation,
  // so they are read once, not on every poll tick).
  useEffect(() => {
    if (!validId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRun();
    void fetchBacktestFeeds(id).then(({ data }) => setFeeds((data ?? []) as BacktestFeed[]));
  }, [id, validId, loadRun]);

  const run = state.kind === "ready" ? state.run : null;
  const status = run?.status;

  // Trades are fetched exactly once, when the run is (or becomes) completed
  // -- not on every poll tick, and not for a failed/active run that has none.
  useEffect(() => {
    if (status !== "completed" || trades !== null) return;
    let cancelled = false;
    void fetchBacktestTrades(id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setTradesError(error);
      else setTrades(data);
    });
    return () => {
      cancelled = true;
    };
  }, [status, id, trades]);

  const delay = run ? pollDelayFor(run.status, run.created_at, nowMs) : null;
  useInterval(() => void loadRun(), delay);

  const closedReported = useMemo(() => reportedClosedTrades(run?.backtrader_analysis), [run?.backtrader_analysis]);

  const back = (
    <Link href="/backtests" className="text-sm text-ink-secondary hover:text-glow transition-colors">
      ← All backtests
    </Link>
  );

  if (!validId || state.kind === "notfound") {
    return (
      <div className="space-y-6">
        {back}
        <Card>
          <p className="text-sm text-ink-muted text-center py-6">That backtest doesn&apos;t exist (or was deleted).</p>
        </Card>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-6">
        {back}
        <Card>
          <p role="alert" className="text-sm text-loss">
            Couldn&apos;t load this backtest: {state.message}
          </p>
        </Card>
      </div>
    );
  }

  if (state.kind === "loading" || !run) {
    return (
      <div className="space-y-6">
        {back}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full rounded-panel" />
        <Skeleton className="h-64 w-full rounded-panel" />
      </div>
    );
  }

  const stale = isStale(run.status, run.created_at, nowMs);
  const duration = formatDuration(run.created_at, run.completed_at);

  return (
    <div className="space-y-6">
      {back}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium tracking-tight break-words">{run.name}</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {formatRunDate(run.start_date)} – {formatRunDate(run.end_date)}
            {duration && <span className="text-ink-muted"> · ran in {duration}</span>}
          </p>
        </div>
        {stale ? (
          <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium bg-loss/15 text-loss">Stalled</span>
        ) : (
          <StatusBadge status={run.status} />
        )}
      </div>

      <Card title="Setup" padding="tight">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">Strategy file</dt>
            <dd className="font-mono text-xs">{run.script_filename}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">Feeds</dt>
            <dd className="font-mono text-xs text-right">
              {feeds.length === 0 ? "—" : feeds.map((f) => `${f.instrument} ${f.timeframe}`).join(", ")}
            </dd>
          </div>
        </dl>
      </Card>

      {stale && (
        <Card>
          <p role="alert" className="text-sm text-loss">
            This run has been marked as running for longer than a backtest can possibly take, so it has stopped updating. The workflow probably failed without being
            able to report back — check the run in GitHub Actions, then start a new backtest.
          </p>
        </Card>
      )}

      {!stale && (run.status === "pending" || run.status === "running") && (
        <Card>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-glow motion-safe:animate-pulse shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{run.status === "pending" ? "Queued — waiting for the workflow to start" : "Running"}</p>
              <p className="text-xs text-ink-muted mt-0.5">
                The first run for an instrument downloads its tick history, which can take a while. This page updates automatically.
              </p>
            </div>
          </div>
        </Card>
      )}

      {run.status === "failed" && (
        <Card title="Run failed">
          <p role="alert" className="text-sm text-loss whitespace-pre-wrap break-words">
            {run.error_message ?? "The run failed, but no error message was recorded."}
          </p>
        </Card>
      )}

      {run.status === "completed" && (
        <>
          <BacktraderResults analysis={run.backtrader_analysis} />
          {tradesError ? (
            <Card title="Trades">
              <p role="alert" className="text-sm text-loss">
                Couldn&apos;t load this run&apos;s trades: {tradesError}
              </p>
            </Card>
          ) : trades === null ? (
            <Skeleton className="h-48 w-full rounded-panel" />
          ) : (
            <BacktestTradesTable trades={trades} reportedClosed={closedReported} />
          )}
        </>
      )}
    </div>
  );
}
