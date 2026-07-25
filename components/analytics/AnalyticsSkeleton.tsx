import Card from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";

// Mirrors AnalyticsHero + the breakdown/R-multiple/rules-followed panels
// beneath it at roughly their real heights.
export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Card padding="tight" className="overflow-hidden">
        <div className="p-2 sm:p-3 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-56 sm:h-64 w-full rounded-lg" />
        </div>
      </Card>
      <Skeleton className="h-72 w-full rounded-panel" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-56 rounded-panel" />
        <Skeleton className="h-56 rounded-panel" />
      </div>
    </div>
  );
}
