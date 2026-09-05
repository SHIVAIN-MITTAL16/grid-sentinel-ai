import { clamp, type DispatchAssets } from "./types";

export interface DispatchOptimizationResult {
  readonly batteryMW: number;
  readonly thermalMW: number;
  readonly hydroMW: number;
  readonly demandResponseMW: number;
  readonly importsMW: number;
  readonly expectedUnservedEnergyMWh: number;
  readonly generationCostPerHour: number;
  readonly carbonEmissionsTonsPerHour: number;
  readonly estimatedFrequencyDeviationHz: number;
  readonly reserveDeficiencyMW: number;
  readonly objectiveScore: number;
}

/**
 * Deterministic merit-order multi-objective dispatch.
 * The selected intervention changes the controllable-resource priority; it never directly mutates an output.
 * Objective combines normalized EUE, cost, carbon, frequency and reserve deficits.
 */
export function optimizeDispatch(assets: DispatchAssets): DispatchOptimizationResult {
  let remainingMW = Math.max(0, assets.demandMW - assets.renewableForecastMW);
  const batterySocFactor = assets.batterySocPct >= 25 ? 1 : assets.batterySocPct / 25;
  const limits = {
    battery: assets.batteryPowerAvailableMW * batterySocFactor,
    hydro: assets.hydroAvailableMW,
    thermal: assets.thermalAvailableMW,
    imports: assets.importAvailableMW,
    demandResponse: assets.demandResponseAvailableMW,
  };
  let batteryMW = 0;
  let hydroMW = 0;
  let thermalMW = 0;
  let importMW = 0;
  let demandResponseMW = 0;
  const dispatch = (resource: keyof typeof limits) => {
    const value = clamp(remainingMW, 0, limits[resource]);
    remainingMW -= value;
    if (resource === "battery") batteryMW = value;
    if (resource === "hydro") hydroMW = value;
    if (resource === "thermal") thermalMW = value;
    if (resource === "imports") importMW = value;
    if (resource === "demandResponse") demandResponseMW = value;
  };
  const order =
    assets.intervention === "battery"
      ? ["battery", "hydro", "imports", "demandResponse", "thermal"]
      : assets.intervention === "thermal"
        ? ["hydro", "thermal", "battery", "imports", "demandResponse"]
        : assets.intervention === "demand-response"
          ? ["demandResponse", "hydro", "battery", "imports", "thermal"]
          : assets.intervention === "imports"
            ? ["imports", "hydro", "battery", "demandResponse", "thermal"]
            : ["hydro", "battery", "imports", "demandResponse", "thermal"];
  order.forEach((resource) => dispatch(resource as keyof typeof limits));

  // Demand response is a load reduction, not generation. Frequency balance uses net demand after response.
  const deliveredMW = assets.renewableForecastMW + hydroMW + batteryMW + importMW + thermalMW;
  const reserveAvailableMW =
    Math.max(0, assets.thermalAvailableMW - thermalMW) +
    Math.max(0, assets.hydroAvailableMW - hydroMW) +
    Math.max(0, assets.batteryPowerAvailableMW - batteryMW);
  const reserveDeficiencyMW = Math.max(0, assets.reserveRequirementMW - reserveAvailableMW);
  const expectedUnservedEnergyMWh = remainingMW;
  const imbalanceMW = deliveredMW - (assets.demandMW - demandResponseMW);
  // Frequency sensitivity: 0.1 Hz per 1% demand imbalance, bounded to an operationally meaningful simplified range.
  const estimatedFrequencyDeviationHz = clamp(
    (imbalanceMW / Math.max(1, assets.demandMW)) * 10,
    -1.2,
    0.2,
  );
  const generationCostPerHour =
    thermalMW * 34 * (assets.thermalCostMultiplier ?? 1) +
    hydroMW * 7 +
    batteryMW * 48 +
    importMW * 42 +
    demandResponseMW * 55;
  const carbonEmissionsTonsPerHour = thermalMW * 0.72;
  const objectiveScore = Math.round(
    (expectedUnservedEnergyMWh / Math.max(1, assets.demandMW)) * 10000 * 0.35 +
      (generationCostPerHour / Math.max(1, assets.demandMW)) * 0.15 +
      (carbonEmissionsTonsPerHour / Math.max(1, assets.demandMW)) * 10 * 0.15 +
      Math.abs(estimatedFrequencyDeviationHz) * 100 * 0.2 +
      (reserveDeficiencyMW / Math.max(1, assets.reserveRequirementMW)) * 100 * 0.15,
  );
  return {
    batteryMW: Math.round(batteryMW),
    thermalMW: Math.round(thermalMW),
    hydroMW: Math.round(hydroMW),
    demandResponseMW: Math.round(demandResponseMW),
    importsMW: Math.round(importMW),
    expectedUnservedEnergyMWh: Math.round(expectedUnservedEnergyMWh),
    generationCostPerHour: Math.round(generationCostPerHour),
    carbonEmissionsTonsPerHour: Math.round(carbonEmissionsTonsPerHour),
    estimatedFrequencyDeviationHz: Math.round(estimatedFrequencyDeviationHz * 1000) / 1000,
    reserveDeficiencyMW: Math.round(reserveDeficiencyMW),
    objectiveScore,
  };
}
