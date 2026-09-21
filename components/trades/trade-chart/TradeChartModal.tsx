"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, ISeriesMarkersPluginApi, Time, UTCTimestamp } from "lightweight-charts";
import { Trade, Direction } from "@/lib/trades";
import { computeTradeChartWindow, coversCandleTarget } from "@/lib/chartTradeWindow";
import { computeEMA } from "@/lib/indicators";

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

// Fixed set of EMA periods the toggle row offers, capped at 30 — matches
// EMA_SEED_CANDLES in lib/chartTradeWindow.ts, which fetches exactly 30
// candles of extra lookback before the display window specifically so
// every period offered here has enough seed data to compute a real (not
// truncated/misleading) value from the first visible candle onward. Adding
// a period above 30 here would need EMA_SEED_CANDLES raised to match, or
// early visible candles would silently get a less-accurate seed.
const EMA_PERIODS = [9, 20, 30] as const;
type EmaPeriod = (typeof EMA_PERIODS)[number];

// One distinct, colorblind-legible color per EMA period so multiple
// overlays stay visually distinguishable from each other and from the
// candlestick colors (teal/rose, see CandlestickSeries options below).
const EMA_COLORS: Record<EmaPeriod, string> = {
  9: "#facc15", // amber
  20: "#60a5fa", // blue
  30: "#c084fc", // violet
};

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
export default function TradeChartModal({
  trade,
  onClose,
  chartDataPath = "/api/chart-data",
  badge,
}: {
  trade: Trade;
  onClose: () => void;
  /**
   * Which candle API to read. Defaults to the live-trade route; the
   * Backtest run page passes "/api/backtest-chart-data" so a backtest
   * trade's chart reads from the backtest bucket (the same candles the
   * strategy traded on) instead of the live one. Both routes share one
   * request/response contract (see lib/chartDataR2.ts).
   */
  chartDataPath?: string;
  /** Small label shown beside the instrument, e.g. "Backtest" — so a simulated trade's chart is never mistaken for a real one. */
  badge?: string;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // No EMA shown by default — an indicator overlay is an opt-in analysis
  // tool, not part of the base chart view every trade opens with.
  const [activeEmaPeriods, setActiveEmaPeriods] = useState<Set<EmaPeriod>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // One line series per possible EMA period, created once alongside the
  // candlestick series (see the chart-init effect below) and toggled via
  // applyOptions({ visible }) rather than added/removed — cheaper than
  // recreating a series every time a period is toggled on/off, and
  // avoids ever leaking a series if toggled rapidly.
  const emaSeriesRef = useRef<Partial<Record<EmaPeriod, ISeriesApi<"Line">>>>({});
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
    const tradeWindow = window_; // narrows to non-null for the rest of this closure
    if (tradeWindow.isFuture) {
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

    const url = new URL(chartDataPath, window.location.origin);
    url.searchParams.set("symbol", trade.instrument);
    url.searchParams.set("timeframe", timeframe);
    url.searchParams.set("start", toDateParam(tradeWindow.fetchStartUtcSeconds));
    url.searchParams.set("end", toDateParam(tradeWindow.rangeEndUtcSeconds));

    fetch(url.toString())
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data || data.error) {
          setState({ status: "error", message: data?.error || "Couldn't load chart data. Please try again." });
          return;
        }
        const candles: Candle[] = data.candles ?? [];
        // The trade's own entry (and exit, if present) is what the chart
        // needs to actually cover — checking this here, against the real
        // response, is what catches "entry already happened but today's
        // sync hasn't run yet" (see coversTarget's doc comment), which
        // isFuture alone can't detect since it only knows the trade's
        // timestamp, not whether R2 has been synced past it.
        const targetUtcSeconds = tradeWindow.exitUtcSeconds ?? tradeWindow.entryUtcSeconds;
        if (!coversCandleTarget(candles, targetUtcSeconds, timeframe)) {
          setState({
            status: "error",
            message:
              chartDataPath === "/api/chart-data"
                ? "Chart data hasn't synced for this trade's time yet — the daily sync runs once a day, so very recent trades may not have data until the next run."
                : "Backtest candle data doesn't cover this trade's time.",
          });
          return;
        }
        setState({ status: "ready", candles });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Couldn't reach chart storage." });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- window_ is derived from trade+timeframe, already covered by those two deps.
  }, [timeframe, trade.instrument, chartDataPath]);

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

    import("lightweight-charts").then(({ createChart, CandlestickSeries, LineSeries, ColorType, createSeriesMarkers }) => {
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

      // Created hidden — the data-push effect below fills each visible
      // one via setData() once state is ready, and the toggle-row effect
      // flips visibility on/off. Created once, up front, for every period
      // EMA_PERIODS offers regardless of which are currently toggled on,
      // so toggling a period never needs to recreate a series mid-session.
      for (const period of EMA_PERIODS) {
        emaSeriesRef.current[period] = chart.addSeries(LineSeries, {
          color: EMA_COLORS[period],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          visible: false,
        });
      }
    });

    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      emaSeriesRef.current = {};
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
    // state.candles includes EMA_SEED_CANDLES worth of extra history before
    // rangeStartUtcSeconds (see chartTradeWindow.ts's fetchStartUtcSeconds) —
    // that lookback is for indicator math only and must never be drawn as a
    // visible bar, so the candlestick series only gets the trade's own
    // display window.
    const visible = window_ ? sorted.filter((c) => c.time >= window_.rangeStartUtcSeconds) : sorted;
    series.setData(visible.map((c) => ({ ...c, time: c.time as UTCTimestamp })));

    // EMA is computed over the FULL fetched range (sorted, seed candles
    // included) — that's the whole point of the extra lookback: an EMA
    // needs `period` prior candles to produce a real value, and computeEMA
    // itself already drops the seed window from its own output (see its
    // doc comment), so the resulting points that actually reach setData()
    // start at or after rangeStartUtcSeconds in every case that matters —
    // no separate filtering needed here.
    for (const period of EMA_PERIODS) {
      const emaSeries = emaSeriesRef.current[period];
      if (!emaSeries) continue;
      const emaPoints = computeEMA(sorted, period);
      emaSeries.setData(emaPoints.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

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

  // Toggles each EMA line series' visibility to match activeEmaPeriods,
  // without touching its data — kept separate from the data-load effect
  // above so flipping a toggle is a cheap visibility flag, not a
  // recompute or a re-fetch. Runs after the chart-init effect has created
  // the series (a no-op via the `?.` below on the very first render,
  // before that effect's dynamic import resolves).
  useEffect(() => {
    for (const period of EMA_PERIODS) {
      emaSeriesRef.current[period]?.applyOptions({ visible: activeEmaPeriods.has(period) });
    }
  }, [activeEmaPeriods]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/80 motion-safe:animate-fade-in" onClick={onClose} />
      <div className="relative w-full h-full sm:h-[85vh] sm:max-w-5xl bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass flex flex-col motion-safe:animate-scale-in overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-surface-border shrink-0">
          <div>
            <h2 className="font-display text-lg font-medium flex items-center gap-2">
              {trade.instrument}
              {badge && <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-glow-violet/20 text-glow-violet font-medium">{badge}</span>}
            </h2>
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
          <span className="w-px h-4 bg-surface-border mx-1 shrink-0" aria-hidden="true" />
          {EMA_PERIODS.map((period) => {
            const active = activeEmaPeriods.has(period);
            return (
              <button
                key={period}
                onClick={() =>
                  setActiveEmaPeriods((prev) => {
                    const next = new Set(prev);
                    if (next.has(period)) next.delete(period);
                    else next.add(period);
                    return next;
                  })
                }
                aria-pressed={active}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors shrink-0 border ${
                  active ? "text-surface-0 border-transparent" : "text-ink-secondary hover:text-ink-primary bg-surface-2 border-transparent"
                }`}
                style={active ? { backgroundColor: EMA_COLORS[period] } : undefined}
              >
                EMA {period}
              </button>
            );
          })}
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
