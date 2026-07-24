"use client";

import { useMemo, useId } from "react";

/**
 * Minimal inline trend line for compact spaces (ribbon/chip contexts) where
 * a full EquityCurveGraph would be too heavy. Uses the same signature
 * teal-to-violet gradient stroke as the main equity curve, no axes/grid/
 * tooltip — just the shape of the trend.
 */
export default function Sparkline({
  values,
  strokeWidth = 1.75,
}: {
  values: number[];
  strokeWidth?: number;
}) {
  const gradientId = useId();

  const path = useMemo(() => {
    if (values.length < 2) return null;

    const width = 100;
    const height = 100;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return [x, y];
    });

    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  }, [values]);

  if (!path) {
    return <div className="w-full h-full" />;
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7C6FF0" />
          <stop offset="100%" stopColor="#5CE6C8" />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
