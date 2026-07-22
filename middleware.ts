import { NextRequest, NextResponse } from "next/server";

// Gates every page in the app behind a single username/password, so that
// having the deployment URL alone isn't enough to view or edit anything —
// this is a personal, single-user journal, not a public app.
//
// Credentials live in environment variables (set in Vercel's project
// settings, never committed to the repo):
//   BASIC_AUTH_USER
//   BASIC_AUTH_PASSWORD
//
// If either is unset, the app fails CLOSED (blocks everything) rather than
// silently falling back to open access — a misconfigured deployment should
// be obviously broken, not silently public.

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Trade journal", charset="UTF-8"' },
  });
}

export function middleware(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return unauthorized();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  const decoded = atob(authHeader.slice("Basic ".length));
  const separatorIndex = decoded.indexOf(":");
  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (user !== expectedUser || password !== expectedPassword) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next.js's own internal asset requests —
  // those are just static JS/CSS chunks with no trade data in them, and
  // excluding them avoids an extra auth prompt cycle on every asset load.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
