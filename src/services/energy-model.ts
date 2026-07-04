import type { GridState } from "./grid-engine";

const DEFAULT_SOLAR_INSTALLED_MW = 2_500;
const DEFAULT_WIND_INSTALLED_MW = 1_800;
const DEFAULT_HYDRO_BASELINE_MW = 700;
const DEFAULT_BATTERY_CAPACITY_MWH = 1_200;
const DEFAULT_DISPATCHABLE_CAPACITY_MW = 4_800;
const DEFAULT_BASE_DEMAND_MW = 6_500;

const HEAT_DEMAND_UPLIFT_MAX = 0.22;
const STORM_DEMAND_UPLIFT_MAX = 0.08;
const CLOUD_DEMAND_UPLIFT_MAX = 0.04;
const HYDRO_PRECIPITATION_UPLIFT_MAX = 0.2;
const HYDRO_STORM_DERATE_MAX = 0.15;
const BATTERY_HEAT_DERATE_MAX = 0.08;
const BATTERY_STORM_RESERVE_DERATE_MAX = 0.12;
const BATTERY_DISCHARGE_DURATION_HOURS = 4;
const THERMAL_CARBON_INTENSITY_G_PER_KWH = 720;
const RENEWABLE_CARBON_INTENSITY_G_PER_KWH = 25;
const DEFICIT_STRESS_FULL_SCALE_MW = 3_000;
const HEALTHY_RESERVE_MARGIN_PERCENT = 20;
const SCORE_DENOMINATOR = 100;
const GRID_STRESS_DEFICIT_WEIGHT = 0.4;
const GRID_STRESS_RESERVE_WEIGHT = 0.25;
const GRID_STRESS_HEAT_WEIGHT = 0.35;
const GRID_STRESS_STORM_WEIGHT = 0.35;
const GRID_STRESS_RENEWABLE_SCARCITY_WEIGHT = 0.3;

interface EnergyState {
  readonly state: string;
  readonly capital: string;
  readonly observedAt: string;
  readonly solarGenerationMw: number;
  readonly windGenerationMw: number;
  readonly hydroEstimateMw: number;
  readonly batteryAvailableMwh: number;
  readonly estimatedDemandMw: number;
  readonly netRenewableGenerationMw: number;
  readonly supplyDemandGapMw: number;
  readonly reserveMarginPercent: number;
  readonly renewablePenetrationPercent: number;
  readonly carbonIntensityEstimate: number;
  readonly gridStressIndex: number;
}

interface EnergyIntermediate {
  readonly solarGenerationMw: number;
  readonly windGenerationMw: number;
  readonly hydroEstimateMw: number;
  readonly batteryAvailableMwh: number;
  readonly estimatedDemandMw: number;
  readonly netRenewableGenerationMw: number;
}

/**
 * Converts weather-derived grid metrics into deterministic electrical energy values.
 */
export function calculateEnergyState(gridState: GridState): EnergyState {
  const values = calculateEnergyValues(gridState);
  const supplyDemandGapMw = calculateSupplyDemandGap(values);
  const reserveMarginPercent = calculateReserveMargin(values);
  const renewablePenetrationPercent = calculateRenewablePenetration(values);

  return {
    state: gridState.state,
    capital: gridState.capital,
    observedAt: gridState.observedAt,
    ...values,
    supplyDemandGapMw,
    reserveMarginPercent,
    renewablePenetrationPercent,
    carbonIntensityEstimate: calculateCarbonIntensity(values, renewablePenetrationPercent),
    gridStressIndex: calculateGridStressIndex(gridState, supplyDemandGapMw, reserveMarginPercent),
  };
}

function calculateEnergyValues(gridState: GridState): EnergyIntermediate {
  const solarGenerationMw = calculateSolarGeneration(gridState);
  const windGenerationMw = calculateWindGeneration(gridState);
  const hydroEstimateMw = calculateHydroEstimate(gridState);
  const batteryAvailableMwh = calculateBatteryAvailable(gridState);
  const estimatedDemandMw = calculateEstimatedDemand(gridState);

  return {
    solarGenerationMw,
    windGenerationMw,
    hydroEstimateMw,
    batteryAvailableMwh,
    estimatedDemandMw,
    netRenewableGenerationMw: solarGenerationMw + windGenerationMw + hydroEstimateMw,
  };
}

// Solar generation follows installed capacity multiplied by weather-derived PV potential.
function calculateSolarGeneration(gridState: GridState): number {
  return roundMw(DEFAULT_SOLAR_INSTALLED_MW * scoreToRatio(gridState.metrics.solarPotential));
}

// Wind generation follows installed capacity multiplied by the grid engine turbine potential score.
function calculateWindGeneration(gridState: GridState): number {
  return roundMw(DEFAULT_WIND_INSTALLED_MW * scoreToRatio(gridState.metrics.windPotential));
}

// Hydro estimate rises with precipitation but is derated during storm conditions for operability.
function calculateHydroEstimate(gridState: GridState): number {
  const precipitationUplift =
    scaleToUnit(gridState.weather.precipitationMm, 0, 20) * HYDRO_PRECIPITATION_UPLIFT_MAX;
  const stormDerate = scoreToRatio(gridState.metrics.stormRisk) * HYDRO_STORM_DERATE_MAX;

  return roundMw(DEFAULT_HYDRO_BASELINE_MW * (1 + precipitationUplift - stormDerate));
}

// Available battery energy is reduced by high heat and storms, which affect usable reserve.
function calculateBatteryAvailable(gridState: GridState): number {
  const heatDerate = scoreToRatio(gridState.metrics.heatStress) * BATTERY_HEAT_DERATE_MAX;
  const stormDerate = scoreToRatio(gridState.metrics.stormRisk) * BATTERY_STORM_RESERVE_DERATE_MAX;

  return roundMwh(DEFAULT_BATTERY_CAPACITY_MWH * (1 - heatDerate - stormDerate));
}

// Demand estimate starts from baseline load and applies weather-driven cooling and disruption uplifts.
function calculateEstimatedDemand(gridState: GridState): number {
  const heatUplift = scoreToRatio(gridState.metrics.heatStress) * HEAT_DEMAND_UPLIFT_MAX;
  const stormUplift = scoreToRatio(gridState.metrics.stormRisk) * STORM_DEMAND_UPLIFT_MAX;
  const cloudUplift = scoreToRatio(gridState.metrics.cloudImpact) * CLOUD_DEMAND_UPLIFT_MAX;

  return roundMw(DEFAULT_BASE_DEMAND_MW * (1 + heatUplift + stormUplift + cloudUplift));
}

// Supply-demand gap compares weather-available supply against estimated demand.
function calculateSupplyDemandGap(values: EnergyIntermediate): number {
  const batteryPowerMw = values.batteryAvailableMwh / BATTERY_DISCHARGE_DURATION_HOURS;
  const availableSupplyMw =
    values.netRenewableGenerationMw + batteryPowerMw + DEFAULT_DISPATCHABLE_CAPACITY_MW;

  return roundMw(availableSupplyMw - values.estimatedDemandMw);
}

// Reserve margin is available surplus divided by demand, expressed as a percentage.
function calculateReserveMargin(values: EnergyIntermediate): number {
  const gapMw = calculateSupplyDemandGap(values);

  return roundPercent((gapMw / values.estimatedDemandMw) * 100);
}

// Renewable penetration is renewable output divided by total estimated demand.
function calculateRenewablePenetration(values: EnergyIntermediate): number {
  return roundPercent((values.netRenewableGenerationMw / values.estimatedDemandMw) * 100);
}

// Carbon intensity estimates blended gCO2/kWh from renewable share and residual thermal supply.
function calculateCarbonIntensity(
  values: EnergyIntermediate,
  renewablePenetrationPercent: number,
): number {
  const renewableRatio = clamp(scoreToRatio(renewablePenetrationPercent), 0, 1);
  const unmetDemandRatio = values.estimatedDemandMw > 0 ? 1 - renewableRatio : 0;

  return Math.round(
    renewableRatio * RENEWABLE_CARBON_INTENSITY_G_PER_KWH +
      unmetDemandRatio * THERMAL_CARBON_INTENSITY_G_PER_KWH,
  );
}

// Stress combines deficit pressure, low reserves, heat, storm risk, and renewable scarcity.
function calculateGridStressIndex(
  gridState: GridState,
  supplyDemandGapMw: number,
  reserveMarginPercent: number,
): number {
  const deficitStress =
    supplyDemandGapMw < 0
      ? scaleToUnit(Math.abs(supplyDemandGapMw), 0, DEFICIT_STRESS_FULL_SCALE_MW)
      : 0;
  const reserveStress = 1 - scaleToUnit(reserveMarginPercent, 0, HEALTHY_RESERVE_MARGIN_PERCENT);
  const weatherStress = scoreToRatio(gridState.metrics.heatStress) * GRID_STRESS_HEAT_WEIGHT;
  const stormStress = scoreToRatio(gridState.metrics.stormRisk) * GRID_STRESS_STORM_WEIGHT;
  const renewableScarcity =
    (1 - scoreToRatio(gridState.metrics.renewableScore)) * GRID_STRESS_RENEWABLE_SCARCITY_WEIGHT;

  return toScore(
    (deficitStress * GRID_STRESS_DEFICIT_WEIGHT +
      reserveStress * GRID_STRESS_RESERVE_WEIGHT +
      weatherStress +
      stormStress +
      renewableScarcity) *
      SCORE_DENOMINATOR,
  );
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

function roundMwh(value: number): number {
  return Math.round(Math.max(0, value));
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function toScore(value: number): number {
  return Math.round(clamp(value, 0, SCORE_DENOMINATOR));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
