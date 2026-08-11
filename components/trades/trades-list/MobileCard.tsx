"use client";

import { memo } from "react";
import {
  DeleteButton,
  PnlText,
  RowProps,
  RulesBadge,
  ScreenshotThumb,
  formatDate,
  formatTime,
} from "./rowParts";

const MobileCard = memo(function MobileCard({
  trade: t,
  index,
  selectionMode,
  isSelected,
  isBest,
  isWorst,
  maxAbsPnl,
  onEdit,
  onDuplicate,
  onRequestDelete,
  onOpenScreenshot,
  onRowClick,
  onCheckboxClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onContextMenuGuard,
}: RowProps) {
  return (
    <div
      onPointerDown={(e) => onPointerDown(t.id, e.target)}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenuGuard}
      onClick={(e) => onRowClick(e, t.id)}
      className={`border rounded-card p-4 transition-colors select-none ${
        isSelected
          ? "bg-glow/10 border-glow/40"
          : isBest
          ? "bg-surface-1 border-gain/40"
          : isWorst
          ? "bg-surface-1 border-loss/40"
          : "bg-surface-1 border-surface-border"
      }`}
      style={{ touchAction: "manipulation" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              onClick={(e) => onCheckboxClick(e, t.id, index)}
              aria-label={`Select trade ${t.instrument}`}
              className="accent-glow mt-1"
            />
          )}
          <span
            className="w-1 h-8 rounded-full shrink-0"
            style={{ background: t.pnl > 0 ? "var(--glow)" : t.pnl < 0 ? "var(--loss)" : "var(--ink-3)" }}
          />
          <div>
            <p className="font-medium flex items-center gap-2">
              {t.instrument}
              {isBest && (
                <span className="text-[10px] uppercase tracking-wide text-gain bg-gain/10 px-1.5 py-0.5 rounded-full shrink-0">
                  Best
                </span>
              )}
              {isWorst && (
                <span className="text-[10px] uppercase tracking-wide text-loss bg-loss/10 px-1.5 py-0.5 rounded-full shrink-0">
                  Worst
                </span>
              )}
            </p>
            <p className="text-xs text-ink-secondary font-mono">
              {formatDate(t.entry_date)}
              {t.entry_time && ` · ${formatTime(t.entry_time)}`} ·{" "}
              <span className="capitalize">{t.direction ?? "—"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ScreenshotThumb
            url={t.screenshot_url}
            onOpen={() => t.screenshot_url && onOpenScreenshot(t.screenshot_url)}
          />
          <div className="flex flex-col items-end gap-1">
            <PnlText value={t.pnl} className="text-base" />
            <div className="w-12 h-1 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  t.pnl > 0 ? "bg-gain" : t.pnl < 0 ? "bg-loss" : "bg-ink-muted"
                }`}
                style={{
                  width: `${maxAbsPnl > 0 ? Math.max(4, (Math.abs(t.pnl) / maxAbsPnl) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-ink-secondary">
        {t.asset_class && <span>{t.asset_class}</span>}
        {t.strategy && <span>{t.strategy}</span>}
        {t.session && <span>{t.session}</span>}
        {t.r_multiple !== null && <span className="font-mono">{t.r_multiple.toFixed(1)}R</span>}
        <span className="flex items-center gap-1">
          Rules: <RulesBadge value={t.rules_followed} />
        </span>
      </div>

      {t.tags && t.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {t.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] text-glow bg-glow/10 border border-glow/25 rounded-full px-2 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-4 mt-3 pt-3 border-t border-surface-border">
        <button onClick={() => onEdit(t)} className="text-xs text-ink-secondary hover:text-glow">
          Edit
        </button>
        <button onClick={() => onDuplicate(t)} className="text-xs text-ink-secondary hover:text-glow">
          Duplicate
        </button>
        <DeleteButton onRequestDelete={() => onRequestDelete(t.id)} />
      </div>
    </div>
  );
});

export default MobileCard;
