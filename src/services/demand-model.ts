import type { calculateEnergyState } from "./energy-model";

type EnergyState = ReturnType<typeof calculateEnergyState>;

const WEEKDAY_DEMAND_FACTOR = 1.0;
const WEEKEND_DEMAND_FACTOR = 0.93;
const MORNING_PEAK_START_HOUR = 7;
const MORNING_PEAK_END_HOUR = 11;
const EVENING_PEAK_START_HOUR = 18;
const EVENING_PEAK_END_HOUR = 23;
const PEAK_TIME_DEMAND_FACTOR = 1.12;
const OFF_PEAK_DEMAND_FACTOR = 0.92;
const NORMAL_TIME_DEMAND_FACTOR = 1.0;
const PEAK_LOAD_HEADROOM_FACTOR = 1.18;
const BASE_LOAD_FACTOR = 0.62;
const ANNUAL_DEMAND_GROWTH_FACTOR = 1.045;
const WEATHER_NEUTRAL_STRESS_INDEX = 35;
const HIGH_STRESS_INDEX = 80;
const COOLING_MULTIPLIER_MAX = 1.35;
const HEATING_MULTIPLIER_MAX = 1.08;
const STRESS_TO_HEATING_WEIGHT = 0.2;
const RESERVE_PRESSURE_HEALTHY_MARGIN_PERCENT = 25;
const LOW_RENEWABLE_STRESS_START_PERCENT = 30;
const LOW_RENEWABLE_STRESS_FULL_PERCENT = 80;
const PEAK_PROBABILITY_PEAK_TIME_WEIGHT = 0.55;
const PEAK_PROBABILITY_NON_PEAK_TIME_WEIGHT = 0.25;
const PEAK_PROBABILITY_STRESS_WEIGHT = 0.3;
const PEAK_PROBABILITY_RESERVE_WEIGHT = 0.15;
const CONFIDENCE_BASE_SCORE = 95;
const CONFIDENCE_STRESS_PENALTY_MAX = 25;
const CONFIDENCE_NEGATIVE_RESERVE_PENALTY = 15;
const CONFIDENCE_DEFICIT_PENALTY = 10;
const DEFAULT_INDUSTRIAL_LOAD_PERCENT = 38;
const DEFAULT_RESIDENTIAL_LOAD_PERCENT = 36;
const DEFAULT_COMMERCIAL_LOAD_PERCENT = 26;
const WEEKDAY_INDUSTRIAL_SHIFT_PERCENT = 3;
const WEEKEND_RESIDENTIAL_SHIFT_PERCENT = 4;
const PEAK_RESIDENTIAL_SHIFT_PERCENT = 3;
const SCORE_DENOMINATOR = 100;
const WEEKEND_DAY_SUNDAY = 0;
const WEEKEND_DAY_SATURDAY = 6;
const ROUND_PERCENT_SCALE = 10;
const ROUND_MULTIPLIER_SCALE = 100;

interface DemandState {
  readonly state: string;
  readonly capital: string;
  readonly observedAt: string;
  readonly estimatedLoadMw: number;
  readonly peakLoadMw: number;
  readonly baseLoadMw: number;
  readonly industrialLoadPercent: number;
  readonly residentialLoadPercent: number;
  readonly commercialLoadPercent: number;
  readonly coolingDemandMultiplier: number;
  readonly heatingDemandMultiplier: number;
  readonly demandGrowthFactor: number;
  readonly peakProbability: number;
  readonly demandConfidenceScore: number;
}

interface DemandContext {
  readonly observedHour: number;
  readonly isWeekend: boolean;
  readonly isPeakHour: boolean;
  readonly timeOfDayFactor: number;
  readonly dayTypeFactor: number;
}

/**
 * Estimates demand composition and load shape from accepted EnergyState values.
 */
export function calculateDemandState(energyState: EnergyState): DemandState {
  const context = buildDemandContext(energyState.observedAt);
  const coolingDemandMultiplier = calculateCoolingDemandMultiplier(energyState);
  const heatingDemandMultiplier = calculateHeatingDemandMultiplier(energyState);
  const estimatedLoadMw = calculateEstimatedLoad(energyState, context);
  const sectorMix = calculateSectorMix(context);

  return {
    state: energyState.state,
    capital: energyState.capital,
    observedAt: energyState.observedAt,
    estimatedLoadMw,
    peakLoadMw: calculatePeakLoad(estimatedLoadMw, context),
    baseLoadMw: calculateBaseLoad(estimatedLoadMw),
    ...sectorMix,
    coolingDemandMultiplier,
    heatingDemandMultiplier,
    demandGrowthFactor: ANNUAL_DEMAND_GROWTH_FACTOR,
    peakProbability: calculatePeakProbability(energyState, context),
    demandConfidenceScore: calculateDemandConfidenceScore(energyState),
  };
}

function buildDemandContext(observedAt: string): DemandContext {
  const observedHour = readHour(observedAt);
  const isWeekend = readIsWeekend(observedAt);
  const isPeakHour = isWithinPeakWindow(observedHour);

  return {
    observedHour,
    isWeekend,
    isPeakHour,
    timeOfDayFactor: calculateTimeOfDayFactor(observedHour),
    dayTypeFactor: isWeekend ? WEEKEND_DEMAND_FACTOR : WEEKDAY_DEMAND_FACTOR,
  };
}

// Estimated load applies time profile, day type, and long-run deterministic growth.
function calculateEstimatedLoad(energyState: EnergyState, context: DemandContext): number {
  const adjustedLoad =
    energyState.estimatedDemandMw *
    context.timeOfDayFactor *
    context.dayTypeFactor *
    ANNUAL_DEMAND_GROWTH_FACTOR;

  return roundMw(adjustedLoad);
}

// Peak load estimates the reachable daily maximum above current estimated load.
function calculatePeakLoad(estimatedLoadMw: number, context: DemandContext): number {
  const peakFactor = context.isPeakHour
    ? PEAK_LOAD_HEADROOM_FACTOR
    : PEAK_LOAD_HEADROOM_FACTOR + 0.07;

  return roundMw(estimatedLoadMw * peakFactor);
}

// Base load represents the non-discretionary portion of state demand.
function calculateBaseLoad(estimatedLoadMw: number): number {
  return roundMw(estimatedLoadMw * BASE_LOAD_FACTOR);
}

// Cooling multiplier uses EnergyState's weather-influenced demand and stress index as heat proxy.
function calculateCoolingDemandMultiplier(energyState: EnergyState): number {
  const stressRatio = scaleToUnit(
    energyState.gridStressIndex,
    WEATHER_NEUTRAL_STRESS_INDEX,
    HIGH_STRESS_INDEX,
  );
  const reservePressure =
    1 - scaleToUnit(energyState.reserveMarginPercent, 0, RESERVE_PRESSURE_HEALTHY_MARGIN_PERCENT);

  return roundMultiplier(1 + Math.max(stressRatio, reservePressure) * (COOLING_MULTIPLIER_MAX - 1));
}

// Heating multiplier remains modest for this India model and rises only when stress is not heat-led.
function calculateHeatingDemandMultiplier(energyState: EnergyState): number {
  const lowRenewableStress = scaleToUnit(
    SCORE_DENOMINATOR - energyState.renewablePenetrationPercent,
    LOW_RENEWABLE_STRESS_START_PERCENT,
    LOW_RENEWABLE_STRESS_FULL_PERCENT,
  );
  const heatingProxy = lowRenewableStress * STRESS_TO_HEATING_WEIGHT;

  return roundMultiplier(1 + heatingProxy * (HEATING_MULTIPLIER_MAX - 1));
}

function calculateSectorMix(context: DemandContext) {
  const industrialShift = context.isWeekend
    ? -WEEKDAY_INDUSTRIAL_SHIFT_PERCENT
    : WEEKDAY_INDUSTRIAL_SHIFT_PERCENT;
  const residentialShift =
    (context.isWeekend ? WEEKEND_RESIDENTIAL_SHIFT_PERCENT : 0) +
    (context.isPeakHour ? PEAK_RESIDENTIAL_SHIFT_PERCENT : 0);
  const industrial = DEFAULT_INDUSTRIAL_LOAD_PERCENT + industrialShift;
  const residential = DEFAULT_RESIDENTIAL_LOAD_PERCENT + residentialShift;

  return normalizeSectorMix(industrial, residential);
}

// Sector percentages are normalized so industrial, residential, and commercial sum to 100.
function normalizeSectorMix(industrial: number, residential: number) {
  const commercial =
    DEFAULT_COMMERCIAL_LOAD_PERCENT -
    (industrial - DEFAULT_INDUSTRIAL_LOAD_PERCENT) -
    (residential - DEFAULT_RESIDENTIAL_LOAD_PERCENT);

  return {
    industrialLoadPercent: roundPercent(industrial),
    residentialLoadPercent: roundPercent(residential),
    commercialLoadPercent: roundPercent(commercial),
  };
}

// Peak probability combines time-of-day exposure with stress and low reserve signals.
function calculatePeakProbability(energyState: EnergyState, context: DemandContext): number {
  const timeSignal = context.isPeakHour
    ? PEAK_PROBABILITY_PEAK_TIME_WEIGHT
    : PEAK_PROBABILITY_NON_PEAK_TIME_WEIGHT;
  const stressSignal = scoreToRatio(energyState.gridStressIndex) * PEAK_PROBABILITY_STRESS_WEIGHT;
  const reserveSignal =
    (1 -
      scaleToUnit(energyState.reserveMarginPercent, 0, RESERVE_PRESSURE_HEALTHY_MARGIN_PERCENT)) *
    PEAK_PROBABILITY_RESERVE_WEIGHT;

  return toScore((timeSignal + stressSignal + reserveSignal) * SCORE_DENOMINATOR);
}

// Confidence declines when stress is high, reserves are weak, or supply-demand balance is negative.
function calculateDemandConfidenceScore(energyState: EnergyState): number {
  const stressPenalty = scoreToRatio(energyState.gridStressIndex) * CONFIDENCE_STRESS_PENALTY_MAX;
  const reservePenalty =
    energyState.reserveMarginPercent < 0 ? CONFIDENCE_NEGATIVE_RESERVE_PENALTY : 0;
  const gapPenalty = energyState.supplyDemandGapMw < 0 ? CONFIDENCE_DEFICIT_PENALTY : 0;

  return toScore(CONFIDENCE_BASE_SCORE - stressPenalty - reservePenalty - gapPenalty);
}

function calculateTimeOfDayFactor(hour: number): number {
  if (isWithinPeakWindow(hour)) return PEAK_TIME_DEMAND_FACTOR;
  if (hour < MORNING_PEAK_START_HOUR || hour >= EVENING_PEAK_END_HOUR)
    return OFF_PEAK_DEMAND_FACTOR;
  return NORMAL_TIME_DEMAND_FACTOR;
}

function isWithinPeakWindow(hour: number): boolean {
  const isMorningPeak = hour >= MORNING_PEAK_START_HOUR && hour < MORNING_PEAK_END_HOUR;
  const isEveningPeak = hour >= EVENING_PEAK_START_HOUR && hour < EVENING_PEAK_END_HOUR;

  return isMorningPeak || isEveningPeak;
}

function readHour(value: string): number {
  const match = value.match(/T(\d{2}):/);
  return match ? Number(match[1]) : MORNING_PEAK_START_HOUR;
}

function readIsWeekend(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getDay() === WEEKEND_DAY_SUNDAY || date.getDay() === WEEKEND_DAY_SATURDAY;
}

function scoreToRatio(score: number): number {
  return clamp(score, 0, SCORE_DENOMINATOR) / SCORE_DENOMINATOR;
}

function scaleToUnit(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function roundMw(value: number): number {
  return Math.round(Math.max(0, value));
}

function roundPercent(value: number): number {
  return Math.round(value * ROUND_PERCENT_SCALE) / ROUND_PERCENT_SCALE;
}

function roundMultiplier(value: number): number {
  return Math.round(value * ROUND_MULTIPLIER_SCALE) / ROUND_MULTIPLIER_SCALE;
}

function toScore(value: number): number {
  return Math.round(clamp(value, 0, SCORE_DENOMINATOR));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
