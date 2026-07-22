"use client";

import { useWinRateMode, WinRateMode } from "@/lib/WinRateModeContext";
import SettingsCard from "./SettingsCard";

const OPTIONS: { value: WinRateMode; label: string; description: string }[] = [
  {
    value: "strict",
    label: "Wins ÷ all trades",
    description: "Breakeven trades count against you. This is the default.",
  },
  {
    value: "decided",
    label: "Wins ÷ decided trades",
    description: "Breakeven trades are excluded entirely, from both wins and losses.",
  },
];

export default function WinRateModeCard() {
  const { mode, setMode } = useWinRateMode();

  return (
    <SettingsCard
      title="Win rate formula"
      description="Applies everywhere win rate is shown — Dashboard, Trades, Analytics, and Reports."
    >
      <div className="flex flex-col gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={`text-left rounded-md border px-4 py-3 transition-colors ${
              mode === opt.value
                ? "border-brass bg-brass/10"
                : "border-surface-border hover:bg-surface-2/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${
                  mode === opt.value ? "border-brass bg-brass" : "border-surface-border"
                }`}
              />
              <span className="text-sm font-medium text-ink-primary">{opt.label}</span>
            </div>
            <p className="text-xs text-ink-secondary mt-1 ml-[22px]">{opt.description}</p>
          </button>
        ))}
      </div>
    </SettingsCard>
  );
}
