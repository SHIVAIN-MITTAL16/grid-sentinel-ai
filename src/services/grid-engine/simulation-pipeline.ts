import {
  analyseNMinusOne,
  evaluateBaseSecurity,
  type ContingencyResult,
} from "./contingency-engine";
import { optimizeDispatch, type DispatchOptimizationResult } from "./dispatch-optimizer";
import { explainDispatch, type ExplainabilityResult } from "./explainability";
import { forecastLoad } from "./load-forecast";
import { calculateSentinelStabilityIndex, type SentinelStabilityIndex } from "./reliability-index";
import { computeRenewables } from "./renewable-engine";
import { calculateReserves } from "./reserve-engine";
import { evaluateWeather } from "./weather-engine";
import { buildRepresentativeNetwork } from "./network-model";
import {
  clamp,
  type Corridor,
  type Bus,
  type DispatchAssets,
  type GeneratorFleet,
  type WeatherInput,
} from "./types";

export type MissionScenario = "base" | "solar-drop" | "transmission-trip" | "cascade";
export type OperatorIntervention = "hold" | "battery" | "thermal" | "demand-response" | "imports";

export interface PipelineInput {
  readonly scenario: MissionScenario;
  readonly intervention: OperatorIntervention;
  readonly timeMinutes: number;
  readonly batterySocPct: number;
  readonly custom?: ScenarioBuilderInput;
}

/** Exogenous operator-authored conditions. These are inputs to, never replacements for, Grid Engine calculations. */
export interface ScenarioBuilderInput {
  readonly heatwaveSeverity: number;
  readonly cloudCoverPct: number;
  readonly windSpeedKmh: number;
  readonly temperatureC: number;
  readonly humidityPct: number;
  readonly demandGrowthPct: number;
  readonly batterySocPct: number;
  readonly generatorTrip: boolean;
  readonly transmissionFailure: boolean;
  readonly importAvailabilityMW: number;
  readonly lngPriceMultiplier: number;
  readonly industrialDemandMultiplier: number;
  readonly renewableForecastErrorPct: number;
}

export interface PipelineResult {
  readonly weather: ReturnType<typeof evaluateWeather>;
  readonly load: ReturnType<typeof forecastLoad>;
  readonly renewables: ReturnType<typeof computeRenewables>;
  readonly reserves: ReturnType<typeof calculateReserves>;
  readonly contingency: ContingencyResult;
  readonly dispatch: DispatchOptimizationResult;
  readonly stability: SentinelStabilityIndex;
  readonly explanation: ExplainabilityResult;
  readonly riskPct: number;
  readonly lineLoadingPct: number;
  readonly availableCapacityMW: number;
  readonly availableGenerationMW: number;
  readonly renewableSharePct: number;
  readonly carbonIntensityKgPerMWh: number;
  /** Applied only to thermal fuel cost; retained for independent cost validation. */
  readonly thermalCostMultiplier: number;
  readonly corridors: readonly Corridor[];
  readonly frequencyHz: number;
  /** Requested control value, retained so validation can report an invalid operator input. */
  readonly inputBatterySocPct: number;
  readonly controlEnvelopeStatus: "AVAILABLE" | "CONTROL_ENVELOPE_EXHAUSTED";
  readonly networkBuses: readonly Bus[];
}

const FLEET: GeneratorFleet = {
  solarCapacityMW: 34000,
  windCapacityMW: 22000,
  hydroCapacityMW: 16000,
  thermalCapacityMW: 105000,
  batteryPowerMW: 8000,
  batteryEnergyMWh: 32000,
  batterySocPct: 82,
};
/**
 * Complete deterministic decision pipeline:
 * mission weather → load forecast → renewable availability → N-1 security → optimizer → reserves → SSI → explanation.
 * Scenario profiles are exogenous weather/asset conditions, not direct mutations of displayed grid state.
 */
export function runSimulationPipeline(input: PipelineInput): PipelineResult {
  const inputBatterySocPct = input.batterySocPct;
  // Controls are bounded before dispatch; validation retains the requested value above for reporting.
  const batterySocPct = clamp(inputBatterySocPct, 0, 100);
  const baselineProfile = scenarioProfile(input.scenario, input.timeMinutes);
  const custom = input.custom;
  const profile = custom
    ? {
        ...baselineProfile,
        temperatureC: custom.temperatureC + custom.heatwaveSeverity * 2,
        cloudCoverPct: custom.cloudCoverPct,
        windSpeedKmh: custom.windSpeedKmh,
        humidityPct: custom.humidityPct,
        industrialCoefficient:
          baselineProfile.industrialCoefficient *
          custom.industrialDemandMultiplier *
          (1 + custom.demandGrowthPct / 100),
        thermalOutageMW: custom.generatorTrip ? 7000 : 0,
        failedCorridorId: custom.transmissionFailure ? "gujarat-maharashtra" : undefined,
      }
    : baselineProfile;
  const weatherInput: WeatherInput = {
    hour: profile.hour,
    state: "India",
    temperatureC: profile.temperatureC,
    cloudCoverPct: profile.cloudCoverPct,
    windSpeedKmh: profile.windSpeedKmh,
    humidityPct: profile.humidityPct,
  };
  const weather = evaluateWeather(weatherInput);
  const load = forecastLoad({
    hour: profile.hour,
    temperatureC: profile.temperatureC,
    weekday: 3,
    industrialCoefficient: profile.industrialCoefficient,
    populationFactor: 1,
    baseDemandMW: 104000,
  });
  const fleet = { ...FLEET, batterySocPct };
  const provisionalRenewables = computeRenewables(
    fleet,
    weather,
    profile.hydroAvailableMW,
    0,
    1,
    load.predictedDemandMW,
  );
  const renewableForecastFactor = 1 - (custom?.renewableForecastErrorPct ?? 0) / 100;
  const assets: DispatchAssets = {
    demandMW: load.predictedDemandMW,
    renewableForecastMW:
      (provisionalRenewables.solarGenerationMW + provisionalRenewables.windGenerationMW) *
      renewableForecastFactor,
    hydroAvailableMW: profile.hydroAvailableMW,
    thermalAvailableMW: Math.max(0, FLEET.thermalCapacityMW - profile.thermalOutageMW),
    batteryPowerAvailableMW: FLEET.batteryPowerMW,
    batterySocPct,
    batteryEnergyMWh: FLEET.batteryEnergyMWh,
    demandResponseAvailableMW: 5200,
    importAvailableMW: custom?.importAvailabilityMW ?? 6500,
    reserveRequirementMW: Math.round(load.predictedDemandMW * 0.1),
    baseThermalMW: 0,
    baseHydroMW: 0,
    intervention: input.intervention,
    thermalCostMultiplier: custom?.lngPriceMultiplier ?? 1,
  };
  const dispatch = optimizeDispatch(assets);
  const resourceRenewables = computeRenewables(
    fleet,
    weather,
    dispatch.hydroMW,
    dispatch.batteryMW,
    1,
    load.predictedDemandMW,
  );
  // Dispatch is scheduled against forecast renewable availability. Reflect the same scheduled
  // solar/wind output in the physical balance and track the withheld resource as curtailment.
  const renewables = {
    ...resourceRenewables,
    solarGenerationMW: Math.round(resourceRenewables.solarGenerationMW * renewableForecastFactor),
    windGenerationMW: Math.round(resourceRenewables.windGenerationMW * renewableForecastFactor),
    curtailmentMW: Math.round(
      resourceRenewables.curtailmentMW +
        (resourceRenewables.solarGenerationMW + resourceRenewables.windGenerationMW) *
          (1 - renewableForecastFactor),
    ),
  };
  const network = buildRepresentativeNetwork({
    demandMW: load.predictedDemandMW,
    solarMW: renewables.solarGenerationMW,
    windMW: renewables.windGenerationMW,
    hydroMW: dispatch.hydroMW,
    thermalMW: dispatch.thermalMW,
    batteryMW: dispatch.batteryMW,
    importsMW: dispatch.importsMW,
    demandResponseMW: dispatch.demandResponseMW,
    unservedLoadMW: dispatch.expectedUnservedEnergyMWh,
  });
  const contingency = profile.failedCorridorId
    ? analyseNMinusOne(network, profile.failedCorridorId)
    : evaluateBaseSecurity(network);
  const lineLoadingPct = Math.max(
    ...contingency.redistributedLoading.map((corridor) => corridor.loadingPct),
  );
  const corridors: readonly Corridor[] = network.lines.map((line) => ({
    id: line.id,
    from: line.fromBus,
    to: line.toBus,
    ratingMW: line.thermalLimitMW,
    baseFlowMW:
      contingency.powerFlow.lineFlows.find((flow) => flow.lineId === line.id)?.flowMW ?? 0,
    outageDistribution: {},
  }));
  const availableCapacityMW =
    assets.thermalAvailableMW +
    profile.hydroAvailableMW +
    FLEET.batteryPowerMW +
    assets.importAvailableMW +
    renewables.solarGenerationMW +
    renewables.windGenerationMW;
  const frequencyHz =
    50 + dispatch.estimatedFrequencyDeviationHz - Math.max(0, lineLoadingPct - 100) * 0.004;
  const reserves = calculateReserves({
    demandMW: load.predictedDemandMW,
    renewableMW: renewables.solarGenerationMW + renewables.windGenerationMW,
    hydroMW: dispatch.hydroMW,
    thermalMW: dispatch.thermalMW,
    batteryMW: dispatch.batteryMW,
    demandResponseMW: dispatch.demandResponseMW,
    importMW: dispatch.importsMW,
    availableCapacityMW,
    frequencyHz,
  });
  const riskPct = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        (dispatch.reserveDeficiencyMW / Math.max(1, assets.reserveRequirementMW)) * 38 +
          (dispatch.expectedUnservedEnergyMWh / Math.max(1, load.predictedDemandMW)) * 100 * 42 +
          Math.max(0, 49.8 - frequencyHz) * 100 +
          Math.max(0, lineLoadingPct - 85) * 1.25 +
          (100 - weather.forecastConfidencePct) * 0.15,
      ),
    ),
  );
  const renewablePenetrationPct =
    ((renewables.solarGenerationMW + renewables.windGenerationMW + dispatch.hydroMW) /
      Math.max(1, load.predictedDemandMW)) *
    100;
  const availableGenerationMW =
    renewables.solarGenerationMW +
    renewables.windGenerationMW +
    dispatch.hydroMW +
    dispatch.thermalMW +
    dispatch.batteryMW +
    dispatch.importsMW;
  const carbonIntensityKgPerMWh =
    (dispatch.carbonEmissionsTonsPerHour / Math.max(1, availableGenerationMW)) * 1000;
  const stability = calculateSentinelStabilityIndex({
    frequencyHz,
    reserveMarginPct: reserves.reserveMarginPct,
    congestionPct: lineLoadingPct,
    expectedEnergyNotServedMWh: dispatch.expectedUnservedEnergyMWh,
    demandMW: load.predictedDemandMW,
    renewablePenetrationPct,
    riskPct,
  });
  const explanation = explainDispatch({
    batterySocPct,
    windForecastConfidencePct: weather.forecastConfidencePct,
    reserveDeficiencyMW: dispatch.reserveDeficiencyMW,
    congestionMW: contingency.newCongestionMW,
    dispatch,
  });
  const batteryDispatchLimitMW = FLEET.batteryPowerMW * Math.min(1, batterySocPct / 25);
  const controlEnvelopeStatus =
    dispatch.expectedUnservedEnergyMWh > 0 &&
    dispatch.thermalMW >= assets.thermalAvailableMW &&
    dispatch.hydroMW >= assets.hydroAvailableMW &&
    dispatch.batteryMW >= batteryDispatchLimitMW &&
    dispatch.importsMW >= assets.importAvailableMW &&
    dispatch.demandResponseMW >= assets.demandResponseAvailableMW
      ? "CONTROL_ENVELOPE_EXHAUSTED"
      : "AVAILABLE";
  return {
    weather,
    load,
    renewables,
    reserves,
    contingency,
    dispatch,
    stability,
    explanation,
    riskPct,
    lineLoadingPct,
    availableCapacityMW,
    availableGenerationMW: Math.round(availableGenerationMW),
    renewableSharePct: Math.round(renewablePenetrationPct * 10) / 10,
    carbonIntensityKgPerMWh: Math.round(carbonIntensityKgPerMWh),
    thermalCostMultiplier: assets.thermalCostMultiplier ?? 1,
    corridors,
    frequencyHz: Math.round(frequencyHz * 100) / 100,
    inputBatterySocPct,
    controlEnvelopeStatus,
    networkBuses: network.buses,
  };
}

function scenarioProfile(scenario: MissionScenario, timeMinutes: number) {
  const hour = 15 + (Math.floor(timeMinutes / 60) % 5);
  if (scenario === "solar-drop")
    return {
      hour,
      temperatureC: 36,
      cloudCoverPct: 86,
      windSpeedKmh: 37,
      humidityPct: 68,
      industrialCoefficient: 1.04,
      hydroAvailableMW: 13500,
      thermalOutageMW: 0,
      failedCorridorId: undefined,
    };
  if (scenario === "transmission-trip")
    return {
      hour,
      temperatureC: 38,
      cloudCoverPct: 30,
      windSpeedKmh: 38,
      humidityPct: 48,
      industrialCoefficient: 1.07,
      hydroAvailableMW: 14000,
      thermalOutageMW: 0,
      failedCorridorId: "gujarat-maharashtra",
    };
  if (scenario === "cascade")
    return {
      hour,
      temperatureC: 45,
      cloudCoverPct: 82,
      windSpeedKmh: 20,
      humidityPct: 62,
      industrialCoefficient: 1.12,
      hydroAvailableMW: 11500,
      thermalOutageMW: 7000,
      failedCorridorId: "gujarat-maharashtra",
    };
  return {
    hour,
    temperatureC: 31,
    cloudCoverPct: 18,
    windSpeedKmh: 40,
    humidityPct: 46,
    industrialCoefficient: 1,
    hydroAvailableMW: 14500,
    thermalOutageMW: 0,
    failedCorridorId: undefined,
  };
}
