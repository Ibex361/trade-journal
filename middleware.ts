import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/supabase/middleware";

// Gates every page in the app behind a real Supabase login, so that having
// the deployment URL alone isn't enough to view or edit anything — this is
// a personal, single-user journal, not a public app.
//
// Replaces the previous HTTP Basic Auth gate: this uses proper sessions
// (cookie-based, survives browser restarts, no native browser popup) backed
// by Supabase Auth, and pairs with RLS policies that require a logged-in
// user (see supabase/phase3_auth_migration.sql) — so even someone with the
// public anon key can't read or write data without being signed in.

const PUBLIC_PATHS = [
  "/login",
  // The Vercel Cron job that pings Supabase to prevent free-tier
  // auto-pause hits this route with no session cookie — it authenticates
  // itself instead via a secret header (see app/api/cron/keep-alive).
  "/api/cron",
];

// PWA install assets — browsers and OSes fetch these with no session
// cookie (e.g. during "Add to Home Screen"), so gating them behind login
// breaks installability. Kept separate from PUBLIC_PATHS: unlike /login,
// these should stay servable even to a logged-in user, not bounce them
// home.
const PWA_PATHS = ["/manifest.webmanifest", "/icons", "/apple-touch-icon.png"];

export async function middleware(request: NextRequest) {
  const { response, user } = await getSessionFromRequest(request);

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isPwaPath = PWA_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath && !isPwaPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already signed in and trying to view the login page — send them home.
  // (Doesn't apply to PWA asset paths: those should stay servable to a
  // logged-in user too, not bounce them to "/".)
  if (user && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // Protect everything except Next.js's own internal asset requests —
  // those are just static JS/CSS chunks with no trade data in them, and
  // excluding them avoids an extra auth check cycle on every asset load.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
