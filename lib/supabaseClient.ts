import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
