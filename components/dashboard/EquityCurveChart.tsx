"use client";

import { EquityPoint } from "@/lib/metrics";
import Card from "@/components/shared/Card";
import EquityCurveGraph from "@/components/dashboard/EquityCurveGraph";

// Card-wrapped equity curve with its own title bar — used on the Analytics
// page. The Dashboard page uses EquityCurveGraph directly instead, folded
// into DashboardHero's own header, so the two don't fight over which one
// owns the "Equity curve" title.
export default function EquityCurveChart({
  points,
  currency,
}: {
  points: EquityPoint[];
  currency: string;
}) {
  const first = points[0]?.balance ?? 0;
  const last = points[points.length - 1]?.balance ?? 0;
  const change = last - first;
  const positive = change >= 0;

  return (
    <Card
      title="Equity curve"
      action={
        points.length > 1 && (
          <span className={`font-mono text-sm ${positive ? "text-gain" : "text-loss"}`}>
            {positive ? "+" : ""}
            {change.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
          </span>
        )
      }
    >
      <EquityCurveGraph points={points} currency={currency} />
    </Card>
  );
}
