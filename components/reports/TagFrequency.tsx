"use client";

import { TagCount } from "@/lib/metrics";

/**
 * Horizontal bar list of how often each tag appeared this month, sorted by
 * frequency. Part of Phase 5 Part 3 ("Highlights").
 */
export default function TagFrequency({ tags }: { tags: TagCount[] }) {
  if (tags.length === 0) {
    return (
      <div className="bg-surface-1 border border-surface-border rounded-card p-5 print:break-inside-avoid">
        <h2 className="font-display text-base font-medium">Tag frequency</h2>
        <p className="text-ink-muted text-sm mt-3">No tags logged this month.</p>
      </div>
    );
  }

  const maxCount = tags[0].count;

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5 print:break-inside-avoid">
      <h2 className="font-display text-base font-medium mb-4">Tag frequency</h2>
      <div className="space-y-2.5">
        {tags.map(({ tag, count }) => (
          <div key={tag} className="flex items-center gap-3">
            <span className="text-sm text-ink-primary w-28 shrink-0 truncate" title={tag}>
              {tag}
            </span>
            <div className="flex-1 h-2 rounded-full bg-surface-2 border border-surface-border overflow-hidden">
              <div
                className="h-full rounded-full bg-brass"
                style={{ width: `${Math.max((count / maxCount) * 100, 4)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-ink-secondary w-6 text-right shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
