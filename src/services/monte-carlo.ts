import { getNationalGridSnapshot } from "./grid-snapshot";

type NationalGridSnapshot = Awaited<ReturnType<typeof getNationalGridSnapshot>>;
type StateSnapshot = NationalGridSnapshot["states"][number];

const DEFAULT_SIMULATION_COUNT = 10_000;
const DEFAULT_SEED = 17_329;
const BATTERY_DISCHARGE_DURATION_HOURS = 4;
const SIMULATION_INTERVAL_HOURS = 1;
const PERCENT_DENOMINATOR = 100;
const DEMAND_STD_DEV_RATIO = 0.04;
const DEMAND_MIN_FACTOR = 0.88;
const DEMAND_MAX_FACTOR = 1.12;
const SOLAR_MIN_FACTOR = 0.72;
const SOLAR_MODE_FACTOR = 1.0;
const SOLAR_MAX_FACTOR = 1.08;
const WIND_MIN_FACTOR = 0.7;
const WIND_MODE_FACTOR = 1.0;
const WIND_MAX_FACTOR = 1.15;
const BATTERY_MIN_FACTOR = 0.82;
const BATTERY_MODE_FACTOR = 1.0;
const BATTERY_MAX_FACTOR = 1.04;
const BLACKOUT_RESERVE_THRESHOLD_PERCENT = 0;
const ROUND_PERCENT_SCALE = 10;
const ROUND_MW_SCALE = 10;

interface MonteCarloOptions {
  readonly simulations?: number;
  readonly seed?: number;
}

interface SimulationPoint {
  readonly supplyMw: number;
  readonly demandMw: number;
  readonly supplyDemandGapMw: number;
  readonly reserveMarginPercent: number;
  readonly renewableGenerationMw: number;
  readonly blackoutEvent: boolean;
}

interface PercentileSet {
  readonly p5: number;
  readonly p50: number;
  readonly p95: number;
}

interface MonteCarloResult {
  readonly simulations: number;
  readonly seed: number;
  readonly blackoutProbability: number;
  readonly meanReserveMargin: number;
  readonly meanSupplyDemandGapMw: number;
  readonly expectedRenewableGenerationMw: number;
  readonly demandPercentiles: PercentileSet;
  readonly renewableGenerationPercentiles: PercentileSet;
  readonly lossOfLoadProbability: number;
  readonly expectedUnservedEnergyMwh: number;
}

/**
 * Runs a seeded probabilistic simulation over the accepted national grid snapshot.
 */
export function runMonteCarloSimulation(
  snapshot: NationalGridSnapshot,
  options: MonteCarloOptions = {},
): MonteCarloResult {
  const simulations = options.simulations ?? DEFAULT_SIMULATION_COUNT;
  const seed = options.seed ?? DEFAULT_SEED;
  const random = createSeededRandom(seed);
  const points = runSimulationPoints(snapshot, simulations, random);

  return aggregateResults(points, simulations, seed);
}

function runSimulationPoints(
  snapshot: NationalGridSnapshot,
  simulations: number,
  random: () => number,
): readonly SimulationPoint[] {
  return Array.from({ length: simulations }, () => runSingleSimulation(snapshot.states, random));
}

function runSingleSimulation(
  states: readonly StateSnapshot[],
  random: () => number,
): SimulationPoint {
  const totals = states.reduce(
    (total, state) => addStateSimulation(total, simulateState(state, random)),
    emptySimulationTotals(),
  );

  return toSimulationPoint(totals);
}

function simulateState(state: StateSnapshot, random: () => number): SimulationTotals {
  const demandMw = varyDemand(state.demand.estimatedLoadMw, random);
  const solarMw = varySolar(state.energy.solarGenerationMw, random);
  const windMw = varyWind(state.energy.windGenerationMw, random);
  const batteryMw = varyBatteryPower(state.energy.batteryAvailableMwh, random);
  const renewableGenerationMw = solarMw + windMw + state.energy.hydroEstimateMw;
  const supplyMw = renewableGenerationMw + batteryMw + calculateDispatchableSupply(state);

  return { supplyMw, demandMw, renewableGenerationMw };
}

interface SimulationTotals {
  readonly supplyMw: number;
  readonly demandMw: number;
  readonly renewableGenerationMw: number;
}

function emptySimulationTotals(): SimulationTotals {
  return { supplyMw: 0, demandMw: 0, renewableGenerationMw: 0 };
}

function addStateSimulation(total: SimulationTotals, next: SimulationTotals): SimulationTotals {
  return {
    supplyMw: total.supplyMw + next.supplyMw,
    demandMw: total.demandMw + next.demandMw,
    renewableGenerationMw: total.renewableGenerationMw + next.renewableGenerationMw,
  };
}

function toSimulationPoint(totals: SimulationTotals): SimulationPoint {
  const supplyDemandGapMw = totals.supplyMw - totals.demandMw;
  const reserveMarginPercent = calculateReserveMargin(supplyDemandGapMw, totals.demandMw);

  return {
    ...totals,
    supplyDemandGapMw,
    reserveMarginPercent,
    blackoutEvent: reserveMarginPercent < BLACKOUT_RESERVE_THRESHOLD_PERCENT,
  };
}

function aggregateResults(
  points: readonly SimulationPoint[],
  simulations: number,
  seed: number,
): MonteCarloResult {
  return {
    simulations,
    seed,
    blackoutProbability: roundPercent(calculateBlackoutProbability(points)),
    meanReserveMargin: roundPercent(mean(points, (point) => point.reserveMarginPercent)),
    meanSupplyDemandGapMw: roundMw(mean(points, (point) => point.supplyDemandGapMw)),
    expectedRenewableGenerationMw: roundMw(mean(points, (point) => point.renewableGenerationMw)),
    demandPercentiles: calculatePercentiles(points.map((point) => point.demandMw)),
    renewableGenerationPercentiles: calculatePercentiles(
      points.map((point) => point.renewableGenerationMw),
    ),
    lossOfLoadProbability: roundPercent(calculateBlackoutProbability(points)),
    expectedUnservedEnergyMwh: roundMw(calculateExpectedUnservedEnergy(points)),
  };
}

function calculateBlackoutProbability(points: readonly SimulationPoint[]): number {
  return (
    (points.filter((point) => point.blackoutEvent).length / points.length) * PERCENT_DENOMINATOR
  );
}

function calculateExpectedUnservedEnergy(points: readonly SimulationPoint[]): number {
  return mean(points, (point) => Math.max(0, -point.supplyDemandGapMw) * SIMULATION_INTERVAL_HOURS);
}

function calculatePercentiles(values: readonly number[]): PercentileSet {
  const sorted = [...values].sort((a, b) => a - b);

  return {
    p5: roundMw(readPercentile(sorted, 0.05)),
    p50: roundMw(readPercentile(sorted, 0.5)),
    p95: roundMw(readPercentile(sorted, 0.95)),
  };
}

function readPercentile(sorted: readonly number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.round((sorted.length - 1) * percentile);
  return sorted[index] ?? 0;
}

// Demand uncertainty uses a truncated normal distribution around forecast load.
function varyDemand(baseDemandMw: number, random: () => number): number {
  const factor = truncatedNormalFactor(
    1,
    DEMAND_STD_DEV_RATIO,
    DEMAND_MIN_FACTOR,
    DEMAND_MAX_FACTOR,
    random,
  );
  return baseDemandMw * factor;
}

// Solar uncertainty uses a triangular distribution: cloud forecast errors are bounded and mode at forecast.
function varySolar(baseSolarMw: number, random: () => number): number {
  return (
    baseSolarMw * triangularFactor(SOLAR_MIN_FACTOR, SOLAR_MODE_FACTOR, SOLAR_MAX_FACTOR, random)
  );
}

// Wind uncertainty uses a wider triangular distribution because wind ramp errors are asymmetric.
function varyWind(baseWindMw: number, random: () => number): number {
  return baseWindMw * triangularFactor(WIND_MIN_FACTOR, WIND_MODE_FACTOR, WIND_MAX_FACTOR, random);
}

// Battery uncertainty uses a tight triangular distribution for usable energy availability.
function varyBatteryPower(baseBatteryMwh: number, random: () => number): number {
  const batteryMwh =
    baseBatteryMwh *
    triangularFactor(BATTERY_MIN_FACTOR, BATTERY_MODE_FACTOR, BATTERY_MAX_FACTOR, random);
  return batteryMwh / BATTERY_DISCHARGE_DURATION_HOURS;
}

function calculateDispatchableSupply(state: StateSnapshot): number {
  const baselineBatteryMw = state.energy.batteryAvailableMwh / BATTERY_DISCHARGE_DURATION_HOURS;
  return Math.max(
    0,
    state.energy.estimatedDemandMw +
      state.energy.supplyDemandGapMw -
      state.energy.netRenewableGenerationMw -
      baselineBatteryMw,
  );
}

function calculateReserveMargin(gapMw: number, demandMw: number): number {
  return demandMw > 0 ? (gapMw / demandMw) * PERCENT_DENOMINATOR : 0;
}

function truncatedNormalFactor(
  meanValue: number,
  stdDev: number,
  min: number,
  max: number,
  random: () => number,
): number {
  return clamp(meanValue + standardNormal(random) * stdDev, min, max);
}

function standardNormal(random: () => number): number {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function triangularFactor(min: number, mode: number, max: number, random: () => number): number {
  const value = random();
  const modeSplit = (mode - min) / (max - min);
  if (value < modeSplit) return min + Math.sqrt(value * (max - min) * (mode - min));
  return max - Math.sqrt((1 - value) * (max - min) * (max - mode));
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function mean<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.length > 0
    ? items.reduce((total, item) => total + selector(item), 0) / items.length
    : 0;
}

function roundMw(value: number): number {
  return Math.round(value * ROUND_MW_SCALE) / ROUND_MW_SCALE;
}

function roundPercent(value: number): number {
  return Math.round(value * ROUND_PERCENT_SCALE) / ROUND_PERCENT_SCALE;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
