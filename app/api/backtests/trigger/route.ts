import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/backtestValidation";

export const runtime = "nodejs";

// The workflow file this route dispatches, and the branch it runs from.
// workflow_dispatch resolves the workflow by filename on the given ref;
// "main" is the repo default (see the project notes: scheduled AND
// dispatched workflows are only reliably available from the default
// branch).
const WORKFLOW_FILE = "backtest.yml";
const WORKFLOW_REF = "main";

/**
 * Starts a backtest by dispatching .github/workflows/backtest.yml for an
 * already-created backtest_runs row.
 *
 * DIVISION OF LABOR — why this route does so little:
 *   - The BROWSER creates the backtest_runs + backtest_run_feeds rows
 *     itself (lib/backtests.ts's createBacktestRun), through the normal
 *     logged-in Supabase client and RLS — exactly how trades and notes
 *     are written everywhere else in this app.
 *   - This ROUTE exists for one reason only: the GitHub token that can
 *     dispatch workflows must never reach the browser, so the dispatch
 *     call has to happen server-side. It receives nothing but a run id.
 *
 * AUTH: this path is behind proxy.ts's session gate like every other
 * /api route except /api/cron — an unauthenticated request never gets
 * here. (The completion webhook, which has no session, is the one
 * deliberate exception and authenticates with its own bearer secret —
 * see ../webhook/route.ts.)
 *
 * What a caller could do with a bogus run id: dispatch a workflow that
 * immediately marks nothing (the row doesn't exist) and fails in its
 * first Python step. Harmless, and not worth a privileged DB key here
 * just to pre-check.
 */
export async function POST(req: NextRequest) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/name"
  if (!token || !repo) {
    return NextResponse.json(
      { error: "Backtests aren't configured on the server (missing GITHUB_DISPATCH_TOKEN / GITHUB_REPO)." },
      { status: 500 }
    );
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return NextResponse.json({ error: "GITHUB_REPO must look like owner/name." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const runId = (body as { runId?: unknown } | null)?.runId;
  if (!isUuid(runId)) {
    return NextResponse.json({ error: "runId must be a UUID." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: WORKFLOW_REF, inputs: { run_id: runId } }),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach GitHub. Please try again." }, { status: 502 });
  }

  // GitHub answers a successful dispatch with 204 No Content.
  if (res.status === 204) {
    return NextResponse.json({ dispatched: true });
  }

  // Translate the failures a person can actually fix into plain language,
  // rather than surfacing GitHub's raw JSON.
  let message: string;
  if (res.status === 401) message = "GitHub rejected the token (GITHUB_DISPATCH_TOKEN is invalid or expired).";
  else if (res.status === 403) message = "GitHub refused the dispatch — the token needs the \"Actions: Read and write\" permission on this repository.";
  else if (res.status === 404) message = "GitHub couldn't find the repository or the backtest.yml workflow on the main branch. Has backtest.yml been pushed to main?";
  else if (res.status === 422) message = "GitHub rejected the dispatch input. Is backtest.yml on the main branch with a run_id input?";
  else message = `GitHub returned an unexpected status (${res.status}).`;
  return NextResponse.json({ error: message }, { status: 502 });
}
