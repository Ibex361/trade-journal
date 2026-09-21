"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { PlusIcon, CloseIcon } from "@/components/icons";
import { createAndStartBacktest } from "@/lib/backtests";
import { validateTriggerInput, BACKTEST_TIMEFRAMES, MAX_FEEDS, MAX_SCRIPT_BYTES } from "@/lib/backtestValidation";

type FeedRow = { key: number; instrument: string; timeframe: string };

const TIMEFRAME_OPTIONS = BACKTEST_TIMEFRAMES.map((tf) => ({ value: tf, label: tf }));

// The strategy contract, shown right where the file is chosen — a strategy
// author needs to know these to write a script the runner can execute.
const CONTRACT_NOTES = [
  "Define exactly one class that extends bt.Strategy.",
  "Each feed is available by name, e.g. self.getdatabyname(\"EURUSD_15min\"). The finest-timeframe feed is self.data.",
  "Candles are built from bid prices and carry no volume.",
  "Trades and Backtrader's analyzers are collected automatically — no extra code needed.",
];

/**
 * The New Backtest form: strategy file, date range, and one or more
 * (instrument, timeframe) feeds. Multi-asset / multi-timeframe is
 * first-class — each row becomes one Backtrader data feed.
 *
 * The .py file is read in the browser (FileReader) and stored in the run
 * row itself, so there's no upload endpoint and the run stays
 * reproducible from its own row. Validation reuses lib/backtestValidation
 * so the form rejects exactly what the server would, before any network.
 */
export default function NewBacktestForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(2);

  const [name, setName] = useState("");
  const [file, setFile] = useState<{ name: string; source: string } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [feeds, setFeeds] = useState<FeedRow[]>([{ key: 1, instrument: "", timeframe: "15min" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (!f.name.toLowerCase().endsWith(".py")) {
      setError("The strategy must be a .py file.");
      return;
    }
    if (f.size > MAX_SCRIPT_BYTES) {
      setError(`That file is too large (max ${MAX_SCRIPT_BYTES / 1024} KB).`);
      return;
    }
    const source = await f.text();
    setFile({ name: f.name, source });
    // Default the run's name to the file's name (minus extension) — one less thing to type.
    setName((current) => current || f.name.replace(/\.py$/i, ""));
  }

  function updateFeed(key: number, patch: Partial<FeedRow>) {
    setFeeds((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addFeed() {
    setFeeds((rows) => {
      // A new row starts as the previous row's instrument on a different
      // timeframe would be presumptuous; start blank but keep the last
      // timeframe, since multi-feed strategies usually share one.
      const last = rows[rows.length - 1];
      return [...rows, { key: nextKey.current++, instrument: "", timeframe: last?.timeframe ?? "15min" }];
    });
  }

  function removeFeed(key: number) {
    setFeeds((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  async function handleSubmit() {
    setError(null);
    const parsed = validateTriggerInput({
      name,
      scriptFilename: file?.name ?? "",
      scriptSource: file?.source ?? "",
      startDate,
      endDate,
      feeds: feeds.map(({ instrument, timeframe }) => ({ instrument, timeframe })),
    });
    if (!parsed.ok) {
      // A missing file otherwise surfaces as the confusing ".py file" message; say what to do.
      setError(!file ? "Choose a strategy file (.py) first." : parsed.error);
      return;
    }

    setSubmitting(true);
    const result = await createAndStartBacktest(parsed.value);
    if (result.error || !result.id) {
      setSubmitting(false);
      setError(result.error ?? "Couldn't start the backtest.");
      return;
    }
    router.push(`/backtests/${result.id}`);
  }

  const labelClass = "block text-[11px] uppercase tracking-wide text-ink-secondary mb-1.5";

  return (
    <Card title="New backtest" description="Upload a Backtrader strategy, pick what it trades and when, and run it in the cloud.">
      <div className="space-y-6">
        <div>
          <label className={labelClass} htmlFor="bt-name">
            Name
          </label>
          <Input id="bt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. EMA cross, EURUSD" className="w-full" maxLength={120} />
        </div>

        <div>
          <span className={labelClass}>Strategy file</span>
          <input ref={fileInputRef} type="file" accept=".py,text/x-python" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-surface-border bg-surface-2 px-4 py-5 flex flex-col items-center gap-1.5 text-center transition-all duration-fast hover:border-glow/50 hover:bg-glow/5"
          >
            {file ? (
              <>
                <span className="font-mono text-sm text-glow">{file.name}</span>
                <span className="text-xs text-ink-muted">{file.source.split("\n").length.toLocaleString()} lines · click to replace</span>
              </>
            ) : (
              <>
                <span className="text-sm text-ink-primary">Choose a .py file</span>
                <span className="text-xs text-ink-muted">Your Backtrader strategy</span>
              </>
            )}
          </button>
          <ul className="mt-3 space-y-1 text-xs text-ink-muted list-disc pl-4">
            {CONTRACT_NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="bt-start">
              Start date
            </label>
            <Input id="bt-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className={labelClass} htmlFor="bt-end">
              End date
            </label>
            <Input id="bt-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
          </div>
        </div>

        <div>
          <span className={labelClass}>Data feeds</span>
          <div className="space-y-2">
            {feeds.map((row, i) => (
              <div key={row.key} className="flex items-center gap-2">
                <Input
                  value={row.instrument}
                  onChange={(e) => updateFeed(row.key, { instrument: e.target.value })}
                  placeholder={i === 0 ? "Instrument, e.g. XAUUSD" : "Instrument"}
                  aria-label={`Feed ${i + 1} instrument`}
                  className="flex-1 min-w-0 uppercase placeholder:normal-case"
                  maxLength={30}
                />
                <Select value={row.timeframe} onChange={(v) => updateFeed(row.key, { timeframe: v })} options={TIMEFRAME_OPTIONS} aria-label={`Feed ${i + 1} timeframe`} className="w-24 py-2" />
                <button
                  type="button"
                  onClick={() => removeFeed(row.key)}
                  disabled={feeds.length === 1}
                  aria-label={`Remove feed ${i + 1}`}
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-ink-muted hover:text-loss hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={addFeed} disabled={feeds.length >= MAX_FEEDS} type="button">
              <PlusIcon className="w-3.5 h-3.5" />
              Add feed
            </Button>
            <span className="text-xs text-ink-muted">One row per instrument + timeframe your strategy reads.</span>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <p className="text-xs text-ink-muted max-w-md">The first run for an instrument downloads its tick history, which can take a while. Later runs reuse the cached candles.</p>
          <Button onClick={handleSubmit} disabled={submitting} type="button">
            {submitting ? "Starting…" : "Run backtest"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
