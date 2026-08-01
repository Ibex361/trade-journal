"use client";

import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";
import { ExitReason, StopMovement } from "@/lib/trades";
import { DateRange, PeriodGranularity, BreakdownDimension, TimeOfDaySource } from "@/lib/metrics";

type ExitStrategySelection = { strategyKey: string; reason: ExitReason } | null;
type SlMovementSelection = { strategyKey: string; movement: StopMovement } | null;

type AnalyticsPageStateContextType = {
  range: DateRange;
  setRange: Dispatch<SetStateAction<DateRange>>;
  granularity: PeriodGranularity;
  setGranularity: Dispatch<SetStateAction<PeriodGranularity>>;
  timeOfDaySource: TimeOfDaySource;
  setTimeOfDaySource: Dispatch<SetStateAction<TimeOfDaySource>>;
  selectedHourKey: string | null;
  setSelectedHourKey: Dispatch<SetStateAction<string | null>>;
  selectedHoldingKey: string | null;
  setSelectedHoldingKey: Dispatch<SetStateAction<string | null>>;
  breakdownDimension: BreakdownDimension;
  setBreakdownDimension: Dispatch<SetStateAction<BreakdownDimension>>;
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
  const [range, setRange] = useState<DateRange>("30d");
  const [granularity, setGranularity] = useState<PeriodGranularity>("day");
  const [timeOfDaySource, setTimeOfDaySource] = useState<TimeOfDaySource>("entry");
  const [selectedHourKey, setSelectedHourKey] = useState<string | null>(null);
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null);
  const [breakdownDimension, setBreakdownDimension] = useState<BreakdownDimension>("instrument");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedRBucketKey, setSelectedRBucketKey] = useState<string | null>(null);
  const [selectedRulesKey, setSelectedRulesKey] = useState<string | null>(null);
  const [selectedExitStrategy, setSelectedExitStrategy] = useState<ExitStrategySelection>(null);
  const [selectedSlMovement, setSelectedSlMovement] = useState<SlMovementSelection>(null);
  const [selectedPlannedRId, setSelectedPlannedRId] = useState<string | null>(null);

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
