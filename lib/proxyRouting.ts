// lib/proxyRouting.ts
//
// The auth-gate routing rules from proxy.ts, extracted into a plain module
// so they can be unit tested (lib/__tests__/proxyRouting.test.ts). Kept
// OUT of proxy.ts itself deliberately: Next.js restricts what a
// proxy/middleware file may export, and this is the login gate for the
// whole app — not somewhere to risk an unverifiable build failure just to
// make a helper importable. proxy.ts imports from here instead.

// Paths reachable with no session. The whole app is behind a login, so
// each entry here is a deliberate hole — every one authenticates itself
// some other way.
export const PUBLIC_PATHS = [
  "/login",
  // The Vercel Cron job that pings Supabase to prevent free-tier
  // auto-pause hits this route with no session cookie — it authenticates
  // itself instead via a secret header (see app/api/cron/keep-alive).
  "/api/cron",
  // GitHub Actions' completion callback for a finished backtest — no
  // session cookie there either, so it authenticates with a bearer
  // secret instead (see app/api/backtests/webhook/route.ts). Listed as
  // the EXACT webhook path, not "/api/backtests", because these entries
  // are matched by prefix and the sibling /api/backtests/trigger route
  // must stay behind the normal session gate.
  "/api/backtests/webhook",
];

// PWA install assets — browsers and OSes fetch these with no session
// cookie (e.g. during "Add to Home Screen"), so gating them behind login
// breaks installability. Kept separate from PUBLIC_PATHS: unlike /login,
// these should stay servable even to a logged-in user, not bounce them
// home.
export const PWA_PATHS = ["/manifest.webmanifest", "/icons", "/apple-touch-icon.png"];

/**
 * What proxy() should do with a request, given its pathname and whether
 * it carries a valid session:
 *   "login" — no session on a protected path: redirect to /login
 *   "home"  — signed in but viewing a public path (e.g. /login): redirect to /
 *   "next"  — let the request through
 */
export function decideRoute(pathname: string, hasUser: boolean): "next" | "login" | "home" {
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isPwaPath = PWA_PATHS.some((path) => pathname.startsWith(path));
  if (!hasUser && !isPublicPath && !isPwaPath) return "login";
  // Already signed in and trying to view the login page — send them home.
  // (Doesn't apply to PWA asset paths: those should stay servable to a
  // logged-in user too, not bounce them to "/".)
  if (hasUser && isPublicPath) return "home";
  return "next";
}
