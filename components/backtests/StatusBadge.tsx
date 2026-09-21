import Badge from "@/components/shared/Badge";
import type { BacktestStatus } from "@/lib/backtests";

const LABELS: Record<BacktestStatus, string> = {
  pending: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

/**
 * Run status pill. Active states pulse a small dot so a run that's still
 * in flight reads as alive rather than as a static label (the page polls
 * while it's active — see useBacktestPolling).
 */
export default function StatusBadge({ status }: { status: BacktestStatus }) {
  const tone = status === "completed" ? "glow" : status === "failed" ? "loss" : "neutral";
  const active = status === "pending" || status === "running";
  return (
    <Badge tone={tone} className="inline-flex items-center gap-1.5">
      {active && <span className="w-1.5 h-1.5 rounded-full bg-glow motion-safe:animate-pulse" aria-hidden="true" />}
      {LABELS[status]}
    </Badge>
  );
}
