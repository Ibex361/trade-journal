import Card from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";

// Mirrors a row of note cards at roughly their real height, same pattern
// as StrategiesSkeleton/ReportsSkeleton.
export default function NotesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} padding="tight" className="space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-24" />
        </Card>
      ))}
    </div>
  );
}
