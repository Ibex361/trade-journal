import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs inside middleware.ts on every request. Reads the Supabase session
// cookie, refreshes it if needed, and returns both the (possibly updated)
// response and a flag saying whether there's a logged-in user — so
// middleware.ts can decide whether to redirect to /login.
export async function getSessionFromRequest(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() (not getSession()) actually validates the token
  // against Supabase rather than just trusting whatever is in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
