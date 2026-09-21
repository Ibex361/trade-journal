import { NextRequest, NextResponse } from "next/server";
import { bearerMatches } from "@/lib/backtestWebhookAuth";
import { validateWebhookPayload } from "@/lib/backtestValidation";

export const runtime = "nodejs";

/**
 * Completion callback from .github/workflows/backtest.yml
 * (scripts/backtest/run_backtest.py's notify_webhook posts here).
 *
 * WHAT IT DOES, AND DELIBERATELY DOESN'T:
 * By the time this fires, run_backtest.py has ALREADY written the run's
 * trades, Backtrader's analysis and its final status straight to
 * Postgres — the database is the single source of truth, and the UI
 * reads it with the normal logged-in session. So this webhook carries no
 * result data and writes nothing. It is a verified "run X finished as Y"
 * signal: authenticated, validated, idempotent, and the hook point for
 * anything that should react to completion later (a push notification, a
 * cache revalidation) without touching the worker.
 *
 * Keeping it write-free is a security decision as much as a simplicity
 * one: this is the ONE route reachable without a session (GitHub has no
 * cookie — it's listed in proxy.ts's PUBLIC_PATHS), so it must not hold
 * a privileged database key. A leaked BACKTEST_WEBHOOK_SECRET can
 * therefore do nothing worse than make this route log a line.
 *
 * AUTH: Authorization: Bearer <BACKTEST_WEBHOOK_SECRET>, compared in
 * constant time. If the secret env var isn't set at all, EVERY request
 * is rejected (bearerMatches never fails open).
 *
 * Idempotent by construction: it has no side effects, so GitHub or the
 * worker retrying a delivery is harmless.
 */
export async function POST(req: NextRequest) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.BACKTEST_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = validateWebhookPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Server log line (visible in Vercel's function logs) — the run's error
  // text is deliberately not echoed back in the response.
  console.log(`[backtest webhook] run ${parsed.value.runId} finished: ${parsed.value.status}`);
  return NextResponse.json({ received: true });
}
