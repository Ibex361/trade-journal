import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/supabase/middleware";
import { decideRoute } from "@/lib/proxyRouting";

// Gates every page in the app behind a real Supabase login, so that having
// the deployment URL alone isn't enough to view or edit anything — this is
// a personal, single-user journal, not a public app.
//
// Replaces the previous HTTP Basic Auth gate: this uses proper sessions
// (cookie-based, survives browser restarts, no native browser popup) backed
// by Supabase Auth, and pairs with RLS policies that require a logged-in
// user (see supabase/phase3_auth_migration.sql) — so even someone with the
// public anon key can't read or write data without being signed in.

export async function proxy(request: NextRequest) {
  const { response, user } = await getSessionFromRequest(request);

  const pathname = request.nextUrl.pathname;
  const decision = decideRoute(pathname, !!user);

  if (decision === "login") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (decision === "home") {
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
