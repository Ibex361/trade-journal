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

const DesktopRow = memo(function DesktopRow({
  trade: t,
  index,
  selectionMode,
  isSelected,
  isBest,
  isWorst,
  maxAbsPnl,
  onEdit,
  onDuplicate,
  onDelete,
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
    <tr
      onPointerDown={(e) => onPointerDown(t.id, e.target)}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenuGuard}
      onClick={(e) => onRowClick(e, t.id)}
      className={`border-b border-surface-border last:border-0 transition-colors select-none ${
        isSelected ? "bg-glow/10 hover:bg-glow/15" : "hover:bg-surface-2/50"
      } ${selectionMode ? "cursor-pointer" : ""} ${
        isBest ? "border-l-2 border-l-gain" : isWorst ? "border-l-2 border-l-loss" : ""
      }`}
      style={{ touchAction: "manipulation" }}
    >
      {selectionMode && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            onClick={(e) => onCheckboxClick(e, t.id, index)}
            aria-label={`Select trade ${t.instrument}`}
            className="accent-glow"
          />
        </td>
      )}
      <td className="px-4 py-3 font-mono text-ink-secondary whitespace-nowrap">
        <div>{formatDate(t.entry_date)}</div>
        {t.entry_time && <div className="text-[11px] text-ink-muted">{formatTime(t.entry_time)}</div>}
      </td>
      <td className="px-4 py-3 font-medium">
        <span className="flex items-center gap-2">
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
        </span>
      </td>
      <td className="px-4 py-3 capitalize text-ink-secondary">{t.direction ?? "—"}</td>
      <td className="px-4 py-3 text-ink-secondary">{t.asset_class ?? "—"}</td>
      <td className="px-4 py-3 text-ink-secondary">{t.strategy ?? "—"}</td>
      <td className="px-4 py-3 text-ink-secondary">{t.session ?? "—"}</td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex flex-col items-end gap-1">
          <PnlText value={t.pnl} />
          <div className="w-14 h-1 rounded-full bg-surface-2 overflow-hidden">
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
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink-secondary">
        {t.r_multiple !== null ? t.r_multiple.toFixed(1) : "—"}
      </td>
      <td className="px-4 py-3">
        <RulesBadge value={t.rules_followed} />
      </td>
      <td className="px-4 py-3">
        <ScreenshotThumb
          url={t.screenshot_url}
          onOpen={() => t.screenshot_url && onOpenScreenshot(t.screenshot_url)}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => onEdit(t)} className="text-xs text-ink-secondary hover:text-glow">
            Edit
          </button>
          <button onClick={() => onDuplicate(t)} className="text-xs text-ink-secondary hover:text-glow">
            Duplicate
          </button>
          <DeleteButton onConfirm={() => onDelete(t.id)} />
        </div>
      </td>
    </tr>
  );
});

export default DesktopRow;
