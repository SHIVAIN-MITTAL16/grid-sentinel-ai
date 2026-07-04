import { getNationalGridSnapshot as getGridEngineSnapshot, type GridState } from "./grid-engine";
import { calculateEnergyState } from "./energy-model";
import { calculateDemandState } from "./demand-model";

type EnergyState = ReturnType<typeof calculateEnergyState>;
type DemandState = ReturnType<typeof calculateDemandState>;

const SCORE_DENOMINATOR = 100;
const HEALTH_RESERVE_TARGET_PERCENT = 20;
const HEALTH_STRESS_WEIGHT = 0.45;
const HEALTH_CONFIDENCE_WEIGHT = 0.35;
const HEALTH_RESERVE_WEIGHT = 0.2;
const ROUND_PERCENT_SCALE = 10;

interface StateSnapshot {
  readonly state: string;
  readonly capital: string;
  readonly observedAt: string;
  readonly grid: GridState;
  readonly energy: EnergyState;
  readonly demand: DemandState;
}

interface RiskStateSummary {
  readonly state: string;
  readonly capital: string;
  readonly gridStressIndex: number;
  readonly demandConfidenceScore: number;
}

interface NationalGridSnapshot {
  readonly timestamp: string;
  readonly states: readonly StateSnapshot[];
  readonly nationalDemandMw: number;
  readonly nationalRenewableGenerationMw: number;
  readonly nationalReserveMarginPercent: number;
  readonly nationalRenewablePenetrationPercent: number;
  readonly nationalGridStressIndex: number;
  readonly averageDemandConfidence: number;
  readonly highestRiskState: RiskStateSummary;
  readonly lowestRiskState: RiskStateSummary;
  readonly systemHealthScore: number;
}

/**
 * Runs the accepted weather, grid, energy, and demand services into one national snapshot.
 */
export async function getNationalGridSnapshot(): Promise<NationalGridSnapshot> {
  const gridSnapshot = await getGridEngineSnapshot();
  const states = gridSnapshot.states.map(createStateSnapshot);

  return {
    timestamp: new Date().toISOString(),
    states,
    nationalDemandMw: calculateNationalDemand(states),
    nationalRenewableGenerationMw: calculateNationalRenewableGeneration(states),
    nationalReserveMarginPercent: calculateNationalReserveMargin(states),
    nationalRenewablePenetrationPercent: calculateNationalRenewablePenetration(states),
    nationalGridStressIndex: calculateNationalGridStressIndex(states),
    averageDemandConfidence: calculateAverageDemandConfidence(states),
    highestRiskState: summarizeRiskState(findHighestRiskState(states)),
    lowestRiskState: summarizeRiskState(findLowestRiskState(states)),
    systemHealthScore: calculateSystemHealthScore(states),
  };
}

function createStateSnapshot(grid: GridState): StateSnapshot {
  const energy = calculateEnergyState(grid);
  const demand = calculateDemandState(energy);

  return {
    state: grid.state,
    capital: grid.capital,
    observedAt: grid.observedAt,
    grid,
    energy,
    demand,
  };
}

function calculateNationalDemand(states: readonly StateSnapshot[]): number {
  return roundMw(sum(states, (state) => state.demand.estimatedLoadMw));
}

function calculateNationalRenewableGeneration(states: readonly StateSnapshot[]): number {
  return roundMw(sum(states, (state) => state.energy.netRenewableGenerationMw));
}

function calculateNationalReserveMargin(states: readonly StateSnapshot[]): number {
  const demandMw = calculateNationalDemand(states);
  const availableSupplyMw = sum(
    states,
    (state) => state.energy.estimatedDemandMw + state.energy.supplyDemandGapMw,
  );

  return demandMw > 0
    ? roundPercent(((availableSupplyMw - demandMw) / demandMw) * SCORE_DENOMINATOR)
    : 0;
}

function calculateNationalRenewablePenetration(states: readonly StateSnapshot[]): number {
  const demandMw = calculateNationalDemand(states);
  const renewableMw = calculateNationalRenewableGeneration(states);

  return demandMw > 0 ? roundPercent((renewableMw / demandMw) * SCORE_DENOMINATOR) : 0;
}

function calculateNationalGridStressIndex(states: readonly StateSnapshot[]): number {
  const demandMw = calculateNationalDemand(states);
  if (demandMw <= 0) return 0;

  return toScore(
    sum(states, (state) => state.energy.gridStressIndex * state.demand.estimatedLoadMw) / demandMw,
  );
}

function calculateAverageDemandConfidence(states: readonly StateSnapshot[]): number {
  if (states.length === 0) return 0;

  return toScore(sum(states, (state) => state.demand.demandConfidenceScore) / states.length);
}

function findHighestRiskState(states: readonly StateSnapshot[]): StateSnapshot {
  return states.reduce((highest, state) =>
    state.energy.gridStressIndex > highest.energy.gridStressIndex ? state : highest,
  );
}

function findLowestRiskState(states: readonly StateSnapshot[]): StateSnapshot {
  return states.reduce((lowest, state) =>
    state.energy.gridStressIndex < lowest.energy.gridStressIndex ? state : lowest,
  );
}

function summarizeRiskState(state: StateSnapshot): RiskStateSummary {
  return {
    state: state.state,
    capital: state.capital,
    gridStressIndex: state.energy.gridStressIndex,
    demandConfidenceScore: state.demand.demandConfidenceScore,
  };
}

function calculateSystemHealthScore(states: readonly StateSnapshot[]): number {
  const stressHealth = SCORE_DENOMINATOR - calculateNationalGridStressIndex(states);
  const confidenceHealth = calculateAverageDemandConfidence(states);
  const reserveHealth = scaleToScore(
    calculateNationalReserveMargin(states),
    0,
    HEALTH_RESERVE_TARGET_PERCENT,
  );

  return toScore(
    stressHealth * HEALTH_STRESS_WEIGHT +
      confidenceHealth * HEALTH_CONFIDENCE_WEIGHT +
      reserveHealth * HEALTH_RESERVE_WEIGHT,
  );
}

function scaleToScore(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return toScore(((value - min) / (max - min)) * SCORE_DENOMINATOR);
}

function sum<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function roundMw(value: number): number {
  return Math.round(Math.max(0, value));
}

function roundPercent(value: number): number {
  return Math.round(value * ROUND_PERCENT_SCALE) / ROUND_PERCENT_SCALE;
}

function toScore(value: number): number {
  return Math.round(clamp(value, 0, SCORE_DENOMINATOR));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
