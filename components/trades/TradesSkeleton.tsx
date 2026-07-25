import Skeleton from "@/components/shared/Skeleton";

// Mirrors TradesPerformanceRibbon + TradesFilterBar + a handful of list
// rows at roughly their real height — this is what fixes the 0.69 CLS
// score the Vercel Toolbar flagged on this page (a one-line "Loading
// trades…" text was popping straight to the full table/card list).
export default function TradesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-surface-1 border border-surface-border rounded-panel p-5 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-card" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}
