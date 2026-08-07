"use client";

import { useEffect, useState } from "react";
import {
  findLegacyScreenshots,
  migrateLegacyScreenshot,
  LegacyScreenshotTrade,
} from "@/lib/screenshots";
import { useTradesData } from "@/lib/TradesDataContext";
import SettingsCard from "./SettingsCard";

type Status = "checking" | "none" | "ready" | "migrating" | "done";

export default function LegacyScreenshotMigrationCard() {
  const { refreshTrades } = useTradesData();
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState<LegacyScreenshotTrade[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);

  useEffect(() => {
    findLegacyScreenshots().then((trades) => {
      setPending(trades);
      setTotal(trades.length);
      setStatus(trades.length === 0 ? "none" : "ready");
    });
  }, []);

  async function handleMigrate() {
    setStatus("migrating");
    setFailures([]);
    const errors: string[] = [];

    // One at a time rather than all at once — this is a background chore,
    // not something that needs to race, and it keeps a slow or flaky
    // download from one old screenshot from tying up a burst of parallel
    // requests to Supabase, ImageKit, and this app's own upload route.
    for (let i = 0; i < pending.length; i++) {
      const trade = pending[i];
      const { error } = await migrateLegacyScreenshot(trade);
      if (error) errors.push(`Trade ${trade.id.slice(0, 8)}: ${error}`);
      setDone(i + 1);
    }

    setFailures(errors);
    setStatus("done");
    // Every migrated trade's screenshot_url/screenshot_file_id changed
    // directly in Supabase, bypassing the shared trades cache — bring it
    // back in sync so Trades/Dashboard/etc. show the new ImageKit links
    // without needing a manual refresh.
    refreshTrades();
  }

  // Nothing left to migrate (or nothing ever was) — no need to take up
  // space in Settings once this one-time chore has nothing to do.
  if (status === "checking" || status === "none") return null;

  return (
    <SettingsCard
      title="Move old screenshots to ImageKit"
      description="Screenshots attached before the switch to ImageKit are still sitting in Supabase Storage, counting against its free-tier limit. This moves them over — one-time, safe to run, and it won't touch anything already on ImageKit."
    >
      <div className="space-y-2">
        {status === "ready" && (
          <button
            onClick={handleMigrate}
            className="text-sm bg-surface-2 border border-surface-border rounded-full px-4 py-1.5 text-ink-primary hover:border-glow/60"
          >
            Migrate {total} screenshot{total === 1 ? "" : "s"} to ImageKit
          </button>
        )}

        {status === "migrating" && (
          <p className="text-sm text-ink-secondary">
            Migrating… {done} of {total}
          </p>
        )}

        {status === "done" && (
          <div className="space-y-2">
            <p className="text-sm text-ink-secondary">
              Migrated {total - failures.length} of {total}.
              {failures.length === 0
                ? " All done — you can now delete the \"trade-screenshots\" bucket in your Supabase dashboard (Storage tab) to reclaim the space."
                : ` ${failures.length} failed — see below. Refresh this page to try those again.`}
            </p>
            {failures.length > 0 && (
              <ul className="text-xs text-loss list-disc list-inside space-y-0.5">
                {failures.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
