"use client";

import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";
import { ExitReason, StopMovement } from "@/lib/trades";
import { DateRange, PeriodGranularity, BreakdownDimension, TimeOfDaySource } from "@/lib/metrics";

type ExitStrategySelection = { strategyKey: string; reason: ExitReason } | null;
type SlMovementSelection = { strategyKey: string; movement: StopMovement } | null;

type AnalyticsPageStateContextType = {
  range: DateRange;
  setRange: (range: DateRange) => void;
  granularity: PeriodGranularity;
  setGranularity: Dispatch<SetStateAction<PeriodGranularity>>;
  timeOfDaySource: TimeOfDaySource;
  setTimeOfDaySource: (source: TimeOfDaySource) => void;
  selectedHourKey: string | null;
  setSelectedHourKey: Dispatch<SetStateAction<string | null>>;
  selectedHoldingKey: string | null;
  setSelectedHoldingKey: Dispatch<SetStateAction<string | null>>;
  breakdownDimension: BreakdownDimension;
  setBreakdownDimension: (dimension: BreakdownDimension) => void;
  selectedGroupKey: string | null;
  setSelectedGroupKey: Dispatch<SetStateAction<string | null>>;
  selectedRBucketKey: string | null;
  setSelectedRBucketKey: Dispatch<SetStateAction<string | null>>;
  selectedRulesKey: string | null;
  setSelectedRulesKey: Dispatch<SetStateAction<string | null>>;
  selectedExitStrategy: ExitStrategySelection;
  setSelectedExitStrategy: Dispatch<SetStateAction<ExitStrategySelection>>;
  selectedSlMovement: SlMovementSelection;
  setSelectedSlMovement: Dispatch<SetStateAction<SlMovementSelection>>;
  selectedPlannedRId: string | null;
  setSelectedPlannedRId: Dispatch<SetStateAction<string | null>>;
};

const AnalyticsPageStateContext = createContext<AnalyticsPageStateContextType | null>(null);

// Same pattern as TradesPageStateProvider: mounted once in the root layout
// so the date range, breakdown dimension, and every chart's drill-down
// selection survive navigating away and back. In-memory only.
export function AnalyticsPageStateProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<DateRange>("30d");
  const [granularity, setGranularity] = useState<PeriodGranularity>("day");
  const [timeOfDaySource, setTimeOfDaySourceState] = useState<TimeOfDaySource>("entry");
  const [selectedHourKey, setSelectedHourKey] = useState<string | null>(null);
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null);
  const [breakdownDimension, setBreakdownDimensionState] = useState<BreakdownDimension>("instrument");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedRBucketKey, setSelectedRBucketKey] = useState<string | null>(null);
  const [selectedRulesKey, setSelectedRulesKey] = useState<string | null>(null);
  const [selectedExitStrategy, setSelectedExitStrategy] = useState<ExitStrategySelection>(null);
  const [selectedSlMovement, setSelectedSlMovement] = useState<SlMovementSelection>(null);
  const [selectedPlannedRId, setSelectedPlannedRId] = useState<string | null>(null);

  // Every chart's drill-down key needs to go stale-free whenever the data
  // underneath it genuinely changes shape (a new range or dimension). That
  // used to be a handful of `useEffect`s in the Analytics page watching for
  // that change — but effects fire once on every mount regardless of
  // whether their dependency actually changed since "last time" (a fresh
  // mount has no "last time" to compare against), so on a page that now
  // remounts on every navigation while this state persists behind it, they
  // were wiping the very selections we just persisted. Clearing synchronously
  // inside the setter — only when the setter is actually called — fixes that:
  // it only ever fires on a real change, never on a remount.
  function setRange(next: DateRange) {
    setRangeState(next);
    setSelectedHourKey(null);
    setSelectedHoldingKey(null);
    setSelectedGroupKey(null);
    setSelectedRBucketKey(null);
    setSelectedRulesKey(null);
    setSelectedExitStrategy(null);
    setSelectedSlMovement(null);
    setSelectedPlannedRId(null);
  }

  function setTimeOfDaySource(next: TimeOfDaySource) {
    setTimeOfDaySourceState(next);
    setSelectedHourKey(null);
  }

  function setBreakdownDimension(next: BreakdownDimension) {
    setBreakdownDimensionState(next);
    setSelectedGroupKey(null);
  }

  return (
    <AnalyticsPageStateContext.Provider
      value={{
        range,
        setRange,
        granularity,
        setGranularity,
        timeOfDaySource,
        setTimeOfDaySource,
        selectedHourKey,
        setSelectedHourKey,
        selectedHoldingKey,
        setSelectedHoldingKey,
        breakdownDimension,
        setBreakdownDimension,
        selectedGroupKey,
        setSelectedGroupKey,
        selectedRBucketKey,
        setSelectedRBucketKey,
        selectedRulesKey,
        setSelectedRulesKey,
        selectedExitStrategy,
        setSelectedExitStrategy,
        selectedSlMovement,
        setSelectedSlMovement,
        selectedPlannedRId,
        setSelectedPlannedRId,
      }}
    >
      {children}
    </AnalyticsPageStateContext.Provider>
  );
}

export function useAnalyticsPageState() {
  const ctx = useContext(AnalyticsPageStateContext);
  if (!ctx) {
    throw new Error("useAnalyticsPageState must be used within AnalyticsPageStateProvider");
  }
  return ctx;
}
