import Card from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";

// Mirrors the leaderboard Card (header + toggle + table rows) at roughly
// its real height, same pattern as ReportsSkeleton/AnalyticsSkeleton.
export default function StrategiesSkeleton() {
  return (
    <div className="space-y-6">
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-40 rounded-full" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </Card>
    </div>
  );
}
