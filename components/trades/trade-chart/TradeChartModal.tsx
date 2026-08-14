"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, ISeriesMarkersPluginApi, Time, UTCTimestamp } from "lightweight-charts";
import { Trade, Direction } from "@/lib/trades";
import { computeTradeChartWindow } from "@/lib/chartTradeWindow";

type Timeframe = "1min" | "5min" | "15min" | "1h" | "4h" | "1day";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1min", label: "1m" },
  { value: "5min", label: "5m" },
  { value: "15min", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1day", label: "1D" },
];

// Timeframe a trade opens on by default — fine enough to see the actual
// entry/exit candles without starting so zoomed in (1min) that a
// multi-hour trade requires a lot of scrolling to see, and without
// starting so zoomed out (1day) that a same-day trade is a single candle.
const DEFAULT_TIMEFRAME: Timeframe = "15min";

type Candle = { time: number; open: number; high: number; low: number; close: number };

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; candles: Candle[] };

function toDateParam(utcSeconds: number): string {
  return new Date(utcSeconds * 1000).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Candlestick chart for a single trade's instrument, opened from the
 * Trades list's "View chart" action (rowParts.tsx / DesktopRow /
 * MobileCard). Separate feature from the existing screenshot
 * thumbnail/lightbox (ScreenshotThumb/ScreenshotLightbox) — that shows
 * the user's own uploaded screenshot; this fetches pre-computed
 * candles synced nightly from Exness's public tick archive into
 * Cloudflare R2 (see scripts/sync-candles.ts + app/api/chart-data/route.ts)
 * and renders them via lightweight-charts, TradingView's own open-source
 * charting library, so pan/zoom/crosshair interactions match what a
 * TradingView user already expects.
 *
 * No symbol-mapping step here (unlike the earlier Twelve-Data-backed
 * version this replaced) — R2 is keyed by this app's own instrument
 * string directly (see candleKey in sync-candles.ts), since the sync
 * pipeline already resolved the Exness archive's own naming quirks
 * (account-type suffixes) at write time. The chart-data route is asked
 * for `trade.instrument` as-is.
 *
 * Hand-rolled overlay (fixed inset-0 + backdrop + Escape-to-close),
 * matching ScreenshotLightbox's own convention rather than the smaller,
 * fixed-max-w-md shared Modal.tsx — a chart needs much more width/height
 * than that component offers.
 */
export default function TradeChartModal({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // Markers are created via createSeriesMarkers (a primitive returned
  // separately from the series itself, not a method on the series) —
  // see lightweight-charts v5's migration notes; kept in a ref so a
  // later effect run can call .setMarkers() on the same primitive
  // instead of creating a new one every time markers need to move.
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const window_ = useMemo(() => computeTradeChartWindow(trade, timeframe), [trade, timeframe]);

  // Fetch candle data whenever the trade's instrument or timeframe changes.
  useEffect(() => {
    if (!window_) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous "can't proceed" branch, not a data sync; same pattern as ExnessContractSizeCard's setPanelRect(null) early-return.
      setState({ status: "error", message: "This trade doesn't have an entry date to chart against." });
      return;
    }
    if (window_.isFuture) {
      // No tick data can exist yet for an entry later than "now" — showing
      // a chart anyway would silently place the marker on whatever the
      // last real candle happens to be (right price, wrong time — see
      // isFuture's doc comment in chartTradeWindow.ts). A clear message is
      // more useful than a misleading chart, and also surfaces a likely
      // data-entry mistake (wrong AM/PM, wrong date) to the user.
      setState({ status: "error", message: "This trade's entry time hasn't happened yet, so there's no chart data for it." });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    const url = new URL("/api/chart-data", window.location.origin);
    url.searchParams.set("symbol", trade.instrument);
    url.searchParams.set("timeframe", timeframe);
    url.searchParams.set("start", toDateParam(window_.rangeStartUtcSeconds));
    url.searchParams.set("end", toDateParam(window_.rangeEndUtcSeconds));

    fetch(url.toString())
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data || data.error) {
          setState({ status: "error", message: data?.error || "Couldn't load chart data. Please try again." });
          return;
        }
        setState({ status: "ready", candles: data.candles ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Couldn't reach chart storage." });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- window_ is derived from trade+timeframe, already covered by those two deps.
  }, [timeframe, trade.instrument]);

  // Create the chart instance once the container is mounted, and tear it
  // down on unmount. Recreated only if the container element itself
  // changes (it never does in practice) — data updates flow through
  // series.setData() in the effect below instead of recreating the chart,
  // which is what keeps pan/zoom state stable across a timeframe switch's
  // data reload.
  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;

    import("lightweight-charts").then(({ createChart, CandlestickSeries, ColorType, createSeriesMarkers }) => {
      if (disposed || !container) return;
      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "rgba(148, 163, 184, 0.08)" },
          horzLines: { color: "rgba(148, 163, 184, 0.08)" },
        },
        timeScale: { timeVisible: true, secondsVisible: false },
        autoSize: true,
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#2dd4bf",
        downColor: "#fb7185",
        borderVisible: false,
        wickUpColor: "#2dd4bf",
        wickDownColor: "#fb7185",
      });
      chartRef.current = chart;
      seriesRef.current = series;
      markersRef.current = createSeriesMarkers(series, []);
    });

    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Push loaded candle data + entry/exit markers into the chart, and
  // scroll to the trade's own window — this effect is what fulfills
  // "opens already scrolled to the trade's time window" (no manual
  // hunting through history) rather than just fitting all loaded data.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    const markersApi = markersRef.current;
    if (!series || !chart || !markersApi) return;
    if (state.status !== "ready") return;

    const sorted = [...state.candles].sort((a, b) => a.time - b.time);
    series.setData(sorted.map((c) => ({ ...c, time: c.time as UTCTimestamp })));

    const markers: Parameters<typeof markersApi.setMarkers>[0] = [];
    if (window_?.entryUtcSeconds !== null && window_?.entryUtcSeconds !== undefined) {
      const isLong: Direction = trade.direction ?? "long";
      // Use atPriceMiddle when entry_price is known — pins the marker dot
      // to the exact Y-axis price rather than floating it above/below the
      // candle's high/low (which can be hundreds of points off when price
      // volatility is high or the candle the marker snapped to is far from
      // the actual entry level). Fall back to bar-relative positioning only
      // when no price is recorded (manually entered trade without a price).
      if (trade.entry_price !== null) {
        markers.push({
          time: window_.entryUtcSeconds as UTCTimestamp,
          position: "atPriceMiddle",
          price: trade.entry_price,
          color: "#2dd4bf",
          shape: isLong === "long" ? "arrowUp" : "arrowDown",
          text: `Entry ${trade.entry_price}`,
        });
      } else {
        markers.push({
          time: window_.entryUtcSeconds as UTCTimestamp,
          position: isLong === "long" ? "belowBar" : "aboveBar",
          color: "#2dd4bf",
          shape: isLong === "long" ? "arrowUp" : "arrowDown",
          text: "Entry",
        });
      }
    }
    if (window_?.exitUtcSeconds !== null && window_?.exitUtcSeconds !== undefined) {
      const exitColor = trade.pnl >= 0 ? "#2dd4bf" : "#fb7185";
      if (trade.exit_price !== null) {
        markers.push({
          time: window_.exitUtcSeconds as UTCTimestamp,
          position: "atPriceMiddle",
          price: trade.exit_price,
          color: exitColor,
          shape: "circle",
          text: `Exit ${trade.exit_price}`,
        });
      } else {
        markers.push({
          time: window_.exitUtcSeconds as UTCTimestamp,
          position: "aboveBar",
          color: exitColor,
          shape: "circle",
          text: "Exit",
        });
      }
    }
    markersApi.setMarkers(markers);

    // Scroll to the trade's own window rather than fitContent()'s "show
    // everything fetched" — the fetch range already has padding (see
    // computeTradeChartWindow), so this centers the visible chart on the
    // trade instead of just guaranteeing the trade is somewhere in range.
    if (window_ && sorted.length > 0) {
      chart.timeScale().setVisibleRange({
        from: window_.rangeStartUtcSeconds as UTCTimestamp,
        to: window_.rangeEndUtcSeconds as UTCTimestamp,
      });
    } else {
      chart.timeScale().fitContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- window_/trade are stable for the lifetime of one candle load; re-running per state.status="ready" is what we want.
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/80 motion-safe:animate-fade-in" onClick={onClose} />
      <div className="relative w-full h-full sm:h-[85vh] sm:max-w-5xl bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass flex flex-col motion-safe:animate-scale-in overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-surface-border shrink-0">
          <div>
            <h2 className="font-display text-lg font-medium">{trade.instrument}</h2>
            <p className="text-xs text-ink-secondary font-mono mt-0.5">
              {trade.entry_date}
              {trade.entry_time && ` ${trade.entry_time}`} · <span className="capitalize">{trade.direction ?? "—"}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-primary/80 hover:text-ink-primary text-2xl leading-none shrink-0"
            aria-label="Close chart"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-surface-border shrink-0 overflow-x-auto">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors shrink-0 ${
                timeframe === tf.value
                  ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0"
                  : "text-ink-secondary hover:text-ink-primary bg-surface-2"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-h-0">
          <div ref={containerRef} className="absolute inset-0" />
          {state.status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-ink-muted">Loading chart…</p>
            </div>
          )}
          {state.status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-sm text-ink-secondary text-center max-w-sm">{state.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
