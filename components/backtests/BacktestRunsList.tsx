"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import StatusBadge from "@/components/backtests/StatusBadge";
import { useInterval } from "@/hooks/useInterval";
import {
  deleteBacktestRun,
  fetchBacktestRuns,
  fetchFeedsForRuns,
  type BacktestFeed,
  type BacktestRunSummary,
} from "@/lib/backtests";
import {
  formatDuration,
  formatRunDate,
  isActiveStatus,
  isStale,
  pollDelayFor,
  summarizeInstruments,
  summarizeTimeframes,
} from "@/lib/backtestFormat";

/**
 * The list of past + in-flight backtest runs.
 *
 * NOT account-scoped, unlike Trades/Strategies: a backtest run isn't tied
 * to any broker account (see supabase/migrations/025_backtests.sql), so
 * this deliberately doesn't read useAccount() or wait for an account to
 * load -- it works the same whichever account is selected.
 *
 * Polls while ANY run is active so a queued -> running -> completed
 * transition shows without a manual refresh. Polling stops on its own
 * once nothing is active (or every active run is stale -- see
 * pollDelayFor), so an idle page makes no requests.
 */
export default function BacktestRunsList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [runs, setRuns] = useState<BacktestRunSummary[] | null>(null);
  const [feedsByRun, setFeedsByRun] = useState<Record<string, BacktestFeed[]>>({});
  const [error, setError] = useState<string | null>(null);
  // Held in state (not read via Date.now() during render) so render stays
  // pure and the stale check moves forward exactly when we re-fetch.
  const [nowMs, setNowMs] = useState(0);
  // One shared confirm dialog for the whole list (not one per row) -- same
  // reasoning as TradesList's requestDelete/confirmingId pattern.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: runsError } = await fetchBacktestRuns();
    if (runsError) {
      setError(runsError.message);
      return;
    }
    const list = (data ?? []) as BacktestRunSummary[];
    // One query for every run's feeds, not one per row.
    const { data: feedRows, error: feedsError } = await fetchFeedsForRuns(list.map((r) => r.id));
    if (feedsError) {
      setError(feedsError.message);
      return;
    }
    const grouped: Record<string, BacktestFeed[]> = {};
    for (const f of (feedRows ?? []) as BacktestFeed[]) (grouped[f.run_id] ??= []).push(f);
    setError(null);
    setFeedsByRun(grouped);
    setRuns(list);
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    // Async fetch -> setState happens after an await, not synchronously in
    // the effect body, so this is the normal load-on-mount pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  // Poll while any run is active and not stale. The list has one interval
  // for all rows, rather than one per row.
  const delay = useMemo(() => {
    if (!runs) return null;
    for (const r of runs) {
      const d = pollDelayFor(r.status, r.created_at, nowMs);
      if (d !== null) return d;
    }
    return null;
  }, [runs, nowMs]);

  useInterval(() => void load(), delay);

  // Deletes the run row -- its feeds and trades go with it via ON DELETE
  // CASCADE (see supabase/migrations/025_backtests.sql). Refetches the
  // list afterward rather than filtering client-side, so feed grouping
  // and counts stay correct with zero extra bookkeeping.
  async function handleDelete() {
    if (!confirmingId) return;
    setDeleting(true);
    setDeleteError(null);
    const { error: delError } = await deleteBacktestRun(confirmingId);
    setDeleting(false);
    setConfirmingId(null);
    if (delError) {
      setDeleteError(delError.message);
      return;
    }
    await load();
  }

  if (error && !runs) {
    return (
      <Card title="Backtests">
        <p role="alert" className="text-sm text-loss">
          Couldn&apos;t load backtests: {error}
        </p>
      </Card>
    );
  }

  if (!runs) {
    return (
      <Card title="Backtests" padding="none" className="overflow-hidden">
        <div className="p-4 sm:p-5 space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Backtests" description={runs.length === 0 ? undefined : `${runs.length} run${runs.length === 1 ? "" : "s"}`}>
      {error && (
        <p role="alert" className="mb-3 text-xs text-loss">
          Couldn&apos;t refresh: {error}
        </p>
      )}
      {deleteError && (
        <p role="alert" className="mb-3 text-xs text-loss">
          Couldn&apos;t delete: {deleteError}
        </p>
      )}
      {runs.length === 0 ? (
        <p className="text-sm text-ink-muted py-4 text-center">No backtests yet. Upload a strategy above to run your first one.</p>
      ) : (
        <ul className="divide-y divide-surface-border -my-2">
          {runs.map((run) => {
            const feeds = feedsByRun[run.id] ?? [];
            const stale = isStale(run.status, run.created_at, nowMs);
            const duration = formatDuration(run.created_at, run.completed_at);
            return (
              <li key={run.id} className="flex items-center gap-1">
                <Link
                  href={`/backtests/${run.id}`}
                  className="flex-1 min-w-0 flex items-center justify-between gap-3 py-3 rounded-lg hover:bg-surface-2/50 transition-colors duration-fast -mx-2 px-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{run.name}</p>
                    <p className="text-xs text-ink-muted mt-0.5 truncate">
                      <span className="font-mono">{summarizeInstruments(feeds)}</span>
                      {" · "}
                      {summarizeTimeframes(feeds)}
                      {" · "}
                      {formatRunDate(run.start_date)} – {formatRunDate(run.end_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {duration && <span className="hidden sm:inline text-xs text-ink-muted font-mono">{duration}</span>}
                    {stale ? (
                      <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium bg-loss/15 text-loss">Stalled</span>
                    ) : (
                      <StatusBadge status={run.status} />
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setConfirmingId(run.id);
                  }}
                  aria-label={`Delete backtest ${run.name}`}
                  className="shrink-0 p-2 rounded-lg text-ink-muted hover:text-loss hover:bg-loss/10 transition-colors"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={confirmingId !== null}
        title="Delete this backtest?"
        description="This permanently deletes the run and all of its trades. This can't be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingId(null)}
      />
      {runs.some((r) => isActiveStatus(r.status)) && delay !== null && (
        <p className="mt-3 text-[11px] text-ink-muted">Updating automatically while runs are in progress.</p>
      )}
    </Card>
  );
}
