import Card from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";

// Mirrors DashboardHero + StatChipRow + the Targets/Recent-trades grid at
// roughly their real heights, so swapping this out for the loaded content
// doesn't shove the page around.
export default function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Card padding="tight" className="overflow-hidden">
        <div className="p-2 sm:p-3 space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-56 sm:h-64 w-full rounded-lg" />
        </div>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-64 rounded-panel" />
      </div>
    </div>
  );
}
