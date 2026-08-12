import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Timeframes TradeChartModal's picker offers, and the exact Twelve Data
// `interval` value each maps to. Kept as an allow-list (rather than
// passing the client's `timeframe` query param straight through) so this
// route can't be used to probe arbitrary Twelve Data intervals or leak
// the API key's rate limit to something the UI never intended to request.
const INTERVAL_BY_TIMEFRAME: Record<string, string> = {
  "1min": "1min",
  "5min": "5min",
  "15min": "15min",
  "1h": "1h",
  "4h": "4h",
  "1day": "1day",
};

type TwelveDataValue = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

/**
 * Proxies candlestick data from Twelve Data. Has to happen server-side
 * because it's authenticated with a Twelve Data API key that must never
 * reach the browser (same reasoning as app/api/screenshots/upload/route.ts
 * proxying ImageKit) — the client only ever talks to this route, passing
 * an already-resolved Twelve Data symbol (see resolveChartSymbol in
 * lib/chartSymbolMap.ts, which runs client-side against the account's
 * overrides before this route is ever called) rather than this app's own
 * instrument symbol.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chart data isn't configured (missing TWELVE_DATA_API_KEY)." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const timeframe = searchParams.get("timeframe");
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }
  const interval = timeframe ? INTERVAL_BY_TIMEFRAME[timeframe] : undefined;
  if (!interval) {
    return NextResponse.json({ error: "Missing or unsupported timeframe." }, { status: 400 });
  }

  const upstream = new URL("https://api.twelvedata.com/time_series");
  upstream.searchParams.set("symbol", symbol);
  upstream.searchParams.set("interval", interval);
  upstream.searchParams.set("timezone", "UTC");
  upstream.searchParams.set("order", "ASC");
  // Twelve Data's free tier caps a single request at 5000 points; letting
  // start/end define the window (rather than a fixed outputsize) is what
  // makes "open already scrolled to the trade" possible — see
  // computeTradeChartWindow in lib/chartTradeWindow.ts, which is what
  // produces these two params.
  if (startDate) upstream.searchParams.set("start_date", startDate);
  if (endDate) upstream.searchParams.set("end_date", endDate);
  upstream.searchParams.set("outputsize", "5000");
  upstream.searchParams.set("apikey", apiKey);

  let res: Response;
  try {
    res = await fetch(upstream.toString());
  } catch {
    return NextResponse.json({ error: "Couldn't reach the chart data provider. Please try again." }, { status: 502 });
  }

  const data = await res.json().catch(() => null);

  // Twelve Data returns HTTP 200 with a JSON error body for most failure
  // modes (bad symbol, plan-restricted symbol, rate limit) rather than a
  // non-2xx status — check status inside the body, not just res.ok.
  if (!res.ok || !data || data.status === "error") {
    const message =
      typeof data?.message === "string"
        ? data.message
        : "Couldn't load chart data for this instrument. Please try again.";
    return NextResponse.json({ error: message }, { status: res.ok ? 502 : res.status });
  }

  const values: TwelveDataValue[] = Array.isArray(data.values) ? data.values : [];

  // Twelve Data's datetime is "YYYY-MM-DD HH:mm:ss" (intraday) or
  // "YYYY-MM-DD" (1day+) already in UTC (timezone=UTC was set above) —
  // parsed with a "Z" suffix so Date.parse treats it as UTC rather than
  // the server process's local timezone.
  const candles = values
    .map((v) => {
      const iso = v.datetime.length > 10 ? `${v.datetime.replace(" ", "T")}Z` : `${v.datetime}T00:00:00Z`;
      const time = Math.floor(new Date(iso).getTime() / 1000);
      return {
        time,
        open: Number(v.open),
        high: Number(v.high),
        low: Number(v.low),
        close: Number(v.close),
      };
    })
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open));

  return NextResponse.json({ candles });
}
