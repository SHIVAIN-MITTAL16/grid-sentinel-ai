/** Shared input and result types for the deterministic Grid Sentinel decision engine. */
export type GridRegion = "north" | "west" | "south" | "east" | "north-east";

/** Reduced-order electrical bus; not a representation of the complete Indian grid. */
export interface Bus {
  readonly id: string;
  readonly name: string;
  readonly region: GridRegion;
  readonly generationMW: number;
  readonly loadMW: number;
}

export interface TransmissionLine {
  readonly id: string;
  readonly fromBus: string;
  readonly toBus: string;
  /** Series reactance on the declared system base. */
  readonly reactancePu: number;
  readonly thermalLimitMW: number;
  readonly status: boolean;
}

export interface GeneratorInjection {
  readonly busId: string;
  readonly generationMW: number;
}

export interface LoadWithdrawal {
  readonly busId: string;
  readonly loadMW: number;
}

export interface PowerFlowLineResult {
  readonly lineId: string;
  readonly fromBus: string;
  readonly toBus: string;
  /** Positive flow is from fromBus to toBus. */
  readonly flowMW: number;
  readonly loadingPct: number;
  readonly thermalLimitMW: number;
  readonly status: "safe" | "watch" | "overload" | "tripped";
}

export interface PowerFlowResult {
  readonly baseMVA: number;
  readonly slackBusId: string;
  readonly solved: boolean;
  readonly busAnglesRad: Readonly<Record<string, number>>;
  readonly netInjectionMW: Readonly<Record<string, number>>;
  readonly lineFlows: readonly PowerFlowLineResult[];
  readonly totalInjectionMW: number;
  readonly isIslanded: boolean;
  readonly disconnectedBusGroups: readonly (readonly string[])[];
  readonly islandImbalanceMW: Readonly<Record<string, number>>;
}

export interface WeatherInput {
  readonly hour: number;
  readonly state: string;
  readonly temperatureC: number;
  readonly cloudCoverPct: number;
  readonly windSpeedKmh: number;
  readonly humidityPct: number;
}

export interface GeneratorFleet {
  readonly solarCapacityMW: number;
  readonly windCapacityMW: number;
  readonly hydroCapacityMW: number;
  readonly thermalCapacityMW: number;
  readonly batteryPowerMW: number;
  readonly batteryEnergyMWh: number;
  readonly batterySocPct: number;
}

export interface DispatchState {
  readonly demandMW: number;
  readonly renewableMW: number;
  readonly hydroMW: number;
  readonly thermalMW: number;
  readonly batteryMW: number;
  readonly demandResponseMW: number;
  readonly importMW: number;
  readonly availableCapacityMW: number;
  readonly frequencyHz: number;
}

export interface Corridor {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly ratingMW: number;
  readonly baseFlowMW: number;
  /** Distribution factors for a failed corridor: corridor id -> share of failed flow. */
  readonly outageDistribution: Readonly<Record<string, number>>;
}

export interface DispatchAssets {
  readonly demandMW: number;
  readonly renewableForecastMW: number;
  readonly hydroAvailableMW: number;
  readonly thermalAvailableMW: number;
  readonly batteryPowerAvailableMW: number;
  readonly batterySocPct: number;
  readonly batteryEnergyMWh: number;
  readonly demandResponseAvailableMW: number;
  readonly importAvailableMW: number;
  readonly reserveRequirementMW: number;
  readonly baseThermalMW: number;
  readonly baseHydroMW: number;
  /** Operator-selected control mode; dispatch order is constrained by this choice. */
  readonly intervention?: "hold" | "battery" | "thermal" | "demand-response" | "imports";
  readonly thermalCostMultiplier?: number;
}

export interface ExplainabilityReason {
  readonly code:
    | "battery_soc"
    | "reserve_deficit"
    | "wind_uncertainty"
    | "congestion"
    | "cost"
    | "carbon"
    | "security";
  readonly message: string;
  readonly confidence: number;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function boundedHour(hour: number): number {
  return ((Math.floor(hour) % 24) + 24) % 24;
}
