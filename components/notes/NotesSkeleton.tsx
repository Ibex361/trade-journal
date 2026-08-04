import Card from "@/components/shared/Card";
import Skeleton from "@/components/shared/Skeleton";

export default function NotesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <Card padding="none" className="overflow-hidden">
        <div className="divide-y divide-surface-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
