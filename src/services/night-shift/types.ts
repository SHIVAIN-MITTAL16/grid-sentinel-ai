export type ActionId = "hold" | "bess" | "thermal" | "demand-response";
export type EventId = "solar-drop" | "transmission-trip" | "cascade";

export interface NightShiftEvent {
  readonly id: EventId;
  readonly number: number;
  readonly title: string;
  readonly location: string;
  readonly cause: string;
  readonly severity: "ELEVATED" | "HIGH" | "S-TIER";
  readonly message: string;
}

export interface NightShiftState {
  readonly timeMinutes: number;
  readonly demandMW: number;
  readonly solarMW: number;
  readonly windMW: number;
  readonly hydroMW: number;
  readonly thermalMW: number;
  readonly batteryMW: number;
  readonly batteryAvailableMW: number;
  readonly availableGenerationMW: number;
  readonly availableCapacityMW: number;
  readonly reserveMW: number;
  readonly reserveMarginPct: number;
  readonly frequencyHz: number;
  readonly unservedLoadMW: number;
  readonly systemRisk: number;
  readonly operatingCost: number;
  readonly carbonIntensity: number;
  readonly carbonImpact: number;
  readonly renewableShare: number;
  readonly lineLoading: number;
  readonly score: number;
  readonly peakRisk: number;
  readonly cumulativeUnservedMWh: number;
  readonly currentEvent: NightShiftEvent | null;
  readonly eventSeverity: number;
  readonly scenario: "base" | EventId;
  readonly batterySocPct: number;
  readonly ssi: number;
  readonly ssiGrade: "Excellent" | "Good" | "Warning" | "Critical";
  readonly expectedUnservedEnergyMWh: number;
  readonly operatorConfidencePct: number;
  readonly networkBuses: readonly Bus[];
  readonly networkPowerFlow: PowerFlowResult;
  readonly networkTopContingencies: readonly DcContingencyResult[];
  readonly controlEnvelopeStatus: "AVAILABLE" | "CONTROL_ENVELOPE_EXHAUSTED";
  readonly sentinelReasons: readonly string[];
  readonly validation: {
    readonly overallGrade: "PASS" | "WARNING" | "FAIL";
    readonly validationScore: number;
    readonly passedConstraints: readonly string[];
    readonly brokenConstraints: readonly string[];
    readonly warnings: readonly string[];
    readonly confidencePct: number;
  };
}

export interface OperatorAction {
  readonly id: ActionId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
}

export interface Outcome {
  readonly state: NightShiftState;
  readonly objective: number;
  readonly reliability: number;
  readonly action: OperatorAction;
}

export interface Comparison {
  readonly human: Outcome;
  readonly sentinel: Outcome;
  readonly scoreDelta: number;
  readonly scoreBreakdown: ReadonlyArray<{ label: string; value: number }>;
}
import type { DcContingencyResult } from "@/services/grid-engine/dc-power-flow";
import type { Bus, PowerFlowResult } from "@/services/grid-engine/types";
