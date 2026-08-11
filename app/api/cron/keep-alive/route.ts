import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Supabase's free tier auto-pauses a project after 7 days with no API
// activity. vercel.json schedules a Cron job that hits this route every
// 3 days — comfortably inside that window — so the project never goes
// quiet long enough to trigger a pause. Nothing else in the app changes.
//
// This route is listed in middleware.ts's PUBLIC_PATHS because Vercel's
// cron invoker doesn't carry a logged-in session cookie. In its place,
// it checks the CRON_SECRET header Vercel automatically attaches to
// cron requests, so this can't be triggered by anyone else hitting the
// URL directly.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase isn't configured." },
      { status: 500 }
    );
  }

  // A plain anon-key client with no session. It doesn't need to actually
  // read any rows — RLS will likely block them since there's no logged-in
  // user — it just needs to reach Supabase's API so the project registers
  // activity. A PostgREST/RLS error back from Supabase still means the
  // ping worked; only a network-level failure to reach Supabase at all
  // is treated as an actual failure below.
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from("accounts").select("id").limit(1);
    return NextResponse.json({
      pinged: true,
      note: error ? `Reached Supabase; query itself was blocked as expected (${error.message}).` : "Reached Supabase.",
    });
  } catch (err) {
    return NextResponse.json(
      { pinged: false, error: err instanceof Error ? err.message : "Failed to reach Supabase." },
      { status: 502 }
    );
  }
}
