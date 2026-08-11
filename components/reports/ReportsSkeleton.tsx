import Skeleton from "@/components/shared/Skeleton";

// Mirrors ReportsHero + the calendar heatmap + spotlight/tag-frequency
// sections at roughly their real heights.
export default function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-surface-1 border border-surface-border rounded-panel p-5 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-72 w-full rounded-panel" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40 rounded-panel" />
        <Skeleton className="h-40 rounded-panel" />
      </div>
    </div>
  );
}
