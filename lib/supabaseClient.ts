import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createBrowserClient (rather than the plain supabase-js createClient)
// stores the session in a cookie instead of localStorage, so the same
// session middleware.ts checks on the server is the one the browser uses
// here — sign-in/sign-out stay in sync between the two.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type Account = {
  id: string;
  name: string;
  broker: string | null;
  currency: string;
  is_demo: boolean;
  is_archived: boolean;
  starting_balance: number;
  journal_start_date: string;
  target_risk_pct: number | null;
  target_monthly_pnl: number | null;
  target_monthly_winrate: number | null;
  created_at: string;
};
