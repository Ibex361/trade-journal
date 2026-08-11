/**
 * Shared loading placeholder. Used to build page-specific skeleton layouts
 * (see DashboardSkeleton, TradesSkeleton, etc.) that approximate the real
 * content's shape and height — the point isn't decoration, it's avoiding
 * the layout-shift jump that a single "Loading…" line causes when it's
 * swapped for the full page once data arrives (flagged by Vercel's CLS
 * diagnostic on the Trades page).
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse motion-reduce:animate-none bg-surface-2 rounded-md ${className}`} />;
}
