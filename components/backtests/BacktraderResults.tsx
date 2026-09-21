"use client";

import { useMemo } from "react";
import Card from "@/components/shared/Card";
import StatCard from "@/components/shared/StatCard";
import { buildAnalysisSections, buildHeadlines } from "@/lib/backtestAnalysis";

/**
 * Backtrader's own output, displayed -- and only displayed. Nothing here
 * computes a metric: headline cards and every row are values copied out of
 * backtest_runs.backtrader_analysis by lib/backtestAnalysis.ts, which is
 * display-only by design (the requirement was "just what Backtrader itself
 * outputs, displayed in the webapp", not a re-derivation of it).
 *
 * The full sections are collapsible <details> rather than one long
 * always-open wall: Backtrader's TradeAnalyzer alone is ~100 rows, and the
 * headline cards already answer the common question. The first section
 * (Trades) starts open since it is what people look for first.
 */
export default function BacktraderResults({ analysis }: { analysis: Record<string, unknown> | null }) {
  const headlines = useMemo(() => buildHeadlines(analysis), [analysis]);
  const sections = useMemo(() => buildAnalysisSections(analysis), [analysis]);

  if (!analysis || sections.length === 0) {
    return (
      <Card title="Backtrader results">
        <p className="text-sm text-ink-muted">Backtrader didn&apos;t produce any analysis for this run.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {headlines.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {headlines.map((h) => (
            <StatCard
              key={h.label}
              label={h.label}
              value={h.value}
              valueClassName={h.tone === "gain" ? "text-gain" : h.tone === "loss" ? "text-loss" : ""}
            />
          ))}
        </div>
      )}

      <Card title="Backtrader results" description="Exactly as Backtrader's analyzers reported them — nothing recalculated by this app.">
        <div className="space-y-2">
          {sections.map((section, i) => (
            <details key={section.key} open={i === 0} className="group rounded-lg border border-surface-border bg-surface-2/40">
              <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium hover:text-glow transition-colors">
                <span>{section.title}</span>
                <span className="text-[11px] text-ink-muted font-normal">
                  {section.rows.length} value{section.rows.length === 1 ? "" : "s"}
                </span>
              </summary>
              <dl className="px-4 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-surface-border/50 last:border-b-0 min-w-0">
                    <dt className="text-xs text-ink-secondary truncate" title={row.label}>
                      {row.label}
                    </dt>
                    <dd className="font-mono text-xs text-ink-primary shrink-0">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
