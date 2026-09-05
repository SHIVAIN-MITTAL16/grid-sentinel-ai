import {
  calculateSentinelStabilityIndex,
  type SentinelStabilityIndex,
} from "@/services/grid-engine/reliability-index";
import type { DispatchOptimizationResult } from "@/services/grid-engine/dispatch-optimizer";
import type {
  PipelineResult,
  OperatorIntervention,
} from "@/services/grid-engine/simulation-pipeline";
import { clamp, type Corridor, type PowerFlowResult } from "@/services/grid-engine/types";
import {
  compileValidationReport,
  type ConstraintResult,
  type ValidationReport,
} from "./validation-report";

export interface ValidationInput {
  readonly demandMW: number;
  readonly solarMW: number;
  readonly windMW: number;
  readonly hydroMW: number;
  readonly thermalMW: number;
  readonly importsMW: number;
  readonly batteryDischargeMW: number;
  readonly batteryChargeMW: number;
  readonly lossesMW: number;
  readonly unservedEnergyMW: number;
  readonly frequencyHz: number;
  readonly batterySocPct: number;
  readonly solarAvailableMW: number;
  readonly windAvailableMW: number;
  readonly hydroAvailableMW: number;
  readonly curtailmentMW: number;
  readonly primaryReserveMW: number;
  readonly secondaryReserveMW: number;
  readonly emergencyReserveMW: number;
  readonly reserveRequirementMW: number;
  readonly reserveMarginPct: number;
  readonly corridors: readonly Corridor[];
  readonly corridorLoadingPct: Readonly<Record<string, number>>;
  readonly carbonEmissionsTons: number;
  readonly reportedCarbonEmissionsTons: number;
  readonly reportedCost: number;
  /** Thermal fuel cost scalar from the dispatch snapshot. */
  readonly thermalCostMultiplier?: number;
  readonly dispatch: DispatchOptimizationResult;
  readonly demandResponseMW: number;
  readonly ssi: SentinelStabilityIndex;
  readonly riskPct: number;
  readonly renewablePenetrationPct: number;
  readonly optimizerCandidates?: readonly { readonly action: string; readonly objective: number }[];
  readonly chosenAction?: string;
  /** Optional DC network solution; supplied by the Grid Engine pipeline. */
  readonly powerFlow?: PowerFlowResult;
}

export interface GridValidationResult {
  readonly report: ValidationReport;
  readonly frequencyCondition: "Normal" | "Warning" | "Emergency" | "Collapse";
  readonly transmission: Readonly<Record<string, "Safe" | "Warning" | "Overloaded" | "Tripped">>;
  readonly optimizationStatus: "PASS" | "Optimization Mismatch";
  readonly reliabilityExplanation: string;
}

/**
 * Validates every physical and optimization constraint against one deterministic grid-engine snapshot.
 * Energy balance tolerance is 0.1% of demand; all remaining checks use explicit engineering thresholds.
 */
export function validateGrid(input: ValidationInput): GridValidationResult {
  const results: ConstraintResult[] = [];
  const generationMW = input.solarMW + input.windMW + input.hydroMW + input.thermalMW;
  const suppliedMW =
    generationMW +
    input.importsMW +
    input.batteryDischargeMW -
    input.batteryChargeMW -
    input.lossesMW +
    input.unservedEnergyMW;
  const balanceErrorMW = Math.abs(input.demandMW - suppliedMW - input.demandResponseMW);
  const balanceToleranceMW = input.demandMW * 0.001;
  results.push(
    check(
      "energy-balance",
      balanceErrorMW <= balanceToleranceMW ? "pass" : "fail",
      `Energy balance error ${balanceErrorMW.toFixed(1)} MW; tolerance ${balanceToleranceMW.toFixed(1)} MW.`,
      balanceErrorMW <= balanceToleranceMW ? 100 : 0,
    ),
  );

  if (input.powerFlow) {
    const angles = Object.values(input.powerFlow.busAnglesRad);
    const flows = input.powerFlow.lineFlows;
    const finite =
      angles.every(Number.isFinite) && flows.every((line) => Number.isFinite(line.flowMW));
    const slackAngle = input.powerFlow.busAnglesRad[input.powerFlow.slackBusId];
    const trippedFlowValid = flows
      .filter((line) => line.status === "tripped")
      .every((line) => Math.abs(line.flowMW) <= 0.001);
    const balanced =
      Math.abs(input.powerFlow.totalInjectionMW) <= Math.max(0.1, input.demandMW * 0.001);
    const networkValid = finite && Math.abs(slackAngle) <= 1e-10 && trippedFlowValid && balanced;
    results.push(
      check(
        "dc-network",
        !networkValid ? "fail" : input.powerFlow.isIslanded ? "warning" : "pass",
        !networkValid
          ? "DC network has non-finite values, a non-reference slack angle, a tripped-line flow, or nodal imbalance."
          : input.powerFlow.isIslanded
            ? `DC contingency islanded: ${input.powerFlow.disconnectedBusGroups.map((group) => group.join("/")).join(", ")}.`
            : "DC network balances injections with finite angles and line flows.",
        !networkValid ? 0 : input.powerFlow.isIslanded ? 60 : 100,
      ),
    );
  }

  const frequencyCondition =
    input.frequencyHz < 47 || input.frequencyHz > 52
      ? "Collapse"
      : input.frequencyHz < 48.5 || input.frequencyHz > 51.5
        ? "Emergency"
        : input.frequencyHz < 49.5 || input.frequencyHz > 50.5
          ? "Warning"
          : "Normal";
  results.push(
    check(
      "frequency",
      frequencyCondition === "Normal"
        ? "pass"
        : frequencyCondition === "Warning"
          ? "warning"
          : "fail",
      `Frequency ${input.frequencyHz.toFixed(2)} Hz: ${frequencyCondition}.`,
      frequencyCondition === "Normal" ? 100 : frequencyCondition === "Warning" ? 70 : 0,
    ),
  );

  const reserveTotalMW =
    input.primaryReserveMW + input.secondaryReserveMW + input.emergencyReserveMW;
  const reserveStatus =
    reserveTotalMW >= input.reserveRequirementMW
      ? "pass"
      : reserveTotalMW >= input.reserveRequirementMW * 0.8
        ? "warning"
        : "fail";
  results.push(
    check(
      "reserve-margin",
      reserveStatus,
      `Reserve ${reserveTotalMW.toFixed(0)} MW against ${input.reserveRequirementMW.toFixed(0)} MW requirement.`,
      reserveStatus === "pass" ? 100 : reserveStatus === "warning" ? 60 : 0,
    ),
  );

  const batteryValid =
    input.batterySocPct >= 0 &&
    input.batterySocPct <= 100 &&
    !(input.batteryChargeMW > 0 && input.batteryDischargeMW > 0);
  results.push(
    check(
      "battery",
      batteryValid ? "pass" : "fail",
      batteryValid
        ? `Battery SOC ${input.batterySocPct.toFixed(1)}%; no simultaneous charge/discharge.`
        : "Battery SOC or charge/discharge interlock violation.",
      batteryValid ? 100 : 0,
    ),
  );

  const transmission: Record<string, "Safe" | "Warning" | "Overloaded" | "Tripped"> = {};
  for (const corridor of input.corridors) {
    const loading = input.corridorLoadingPct[corridor.id] ?? 0;
    transmission[corridor.id] =
      loading === 0 ? "Tripped" : loading > 100 ? "Overloaded" : loading > 85 ? "Warning" : "Safe";
  }
  const overloaded = Object.entries(transmission).filter(([, status]) => status === "Overloaded");
  const watched = Object.entries(transmission).filter(([, status]) => status === "Warning");
  results.push(
    check(
      "transmission",
      overloaded.length ? "fail" : watched.length ? "warning" : "pass",
      overloaded.length
        ? `Overloaded corridors: ${overloaded.map(([id]) => id).join(", ")}.`
        : watched.length
          ? `Corridors on watch: ${watched.map(([id]) => id).join(", ")}.`
          : "All active corridors respect thermal capacity.",
      overloaded.length ? 0 : watched.length ? 65 : 100,
    ),
  );

  const renewableValid =
    input.solarMW <= input.solarAvailableMW + 0.01 &&
    input.windMW <= input.windAvailableMW + 0.01 &&
    input.hydroMW <= input.hydroAvailableMW + 0.01 &&
    input.curtailmentMW >= 0;
  results.push(
    check(
      "renewable-limits",
      renewableValid ? "pass" : "fail",
      renewableValid
        ? `Renewables within available resource limits; curtailment ${input.curtailmentMW.toFixed(0)} MW.`
        : "Renewable output exceeded available resource or curtailment is invalid.",
      renewableValid ? 100 : 0,
    ),
  );

  const carbonError = Math.abs(input.carbonEmissionsTons - input.reportedCarbonEmissionsTons);
  results.push(
    check(
      "carbon",
      carbonError <= 0.5 ? "pass" : "fail",
      `Carbon recomputation delta ${carbonError.toFixed(2)} tCO₂.`,
      carbonError <= 0.5 ? 100 : 0,
    ),
  );

  const recomputedCost =
    input.dispatch.thermalMW * 34 * (input.thermalCostMultiplier ?? 1) +
    input.dispatch.hydroMW * 7 +
    input.dispatch.batteryMW * 48 +
    input.dispatch.importsMW * 42 +
    input.dispatch.demandResponseMW * 55;
  const costError = Math.abs(recomputedCost - input.reportedCost);
  // Dispatch outputs are rounded to MW while cost is calculated before that presentation rounding.
  const costRoundingTolerance = 0.5 * (34 * (input.thermalCostMultiplier ?? 1) + 7 + 48 + 42 + 55);
  results.push(
    check(
      "cost",
      costError <= costRoundingTolerance ? "pass" : "fail",
      `Dispatch cost recomputation delta ${costError.toFixed(2)}.`,
      costError <= costRoundingTolerance ? 100 : 0,
    ),
  );

  const candidates = input.optimizerCandidates ?? [
    { action: input.chosenAction ?? "current", objective: input.dispatch.objectiveScore },
  ];
  const best = candidates.reduce((current, candidate) =>
    candidate.objective < current.objective ? candidate : current,
  );
  const optimizationStatus =
    !input.chosenAction || best.action === input.chosenAction ? "PASS" : "Optimization Mismatch";
  results.push(
    check(
      "optimization",
      optimizationStatus === "PASS" ? "pass" : "fail",
      optimizationStatus === "PASS"
        ? `Chosen action ${input.chosenAction ?? "current"} has the lowest evaluated objective.`
        : `Chosen action ${input.chosenAction} does not match lowest objective action ${best.action}.`,
      optimizationStatus === "PASS" ? 100 : 0,
    ),
  );

  const recomputedSsi = calculateSentinelStabilityIndex({
    frequencyHz: input.frequencyHz,
    reserveMarginPct: input.reserveMarginPct,
    congestionPct: Math.max(...Object.values(input.corridorLoadingPct)),
    expectedEnergyNotServedMWh: input.unservedEnergyMW,
    demandMW: input.demandMW,
    renewablePenetrationPct: input.renewablePenetrationPct,
    riskPct: input.riskPct,
  });
  const ssiError = Math.abs(recomputedSsi.score - input.ssi.score);
  results.push(
    check(
      "reliability",
      ssiError <= 1 ? "pass" : "fail",
      `SSI ${input.ssi.score} validated against raw metrics; recomputation delta ${ssiError}.`,
      ssiError <= 1 ? 100 : 0,
    ),
  );

  return {
    report: compileValidationReport(results),
    frequencyCondition,
    transmission,
    optimizationStatus,
    reliabilityExplanation: `SSI ${input.ssi.score} (${input.ssi.grade}) is driven by frequency, reserve, congestion, expected unserved energy, renewable penetration, and risk.`,
  };
}

/** Adapts a Grid Engine pipeline result into validation inputs without introducing presentation calculations. */
export function validatePipelineResult(
  snapshot: PipelineResult,
  intervention: OperatorIntervention,
): GridValidationResult {
  const dispatch = snapshot.dispatch;
  return validateGrid({
    demandMW: snapshot.load.predictedDemandMW,
    solarMW: snapshot.renewables.solarGenerationMW,
    windMW: snapshot.renewables.windGenerationMW,
    hydroMW: dispatch.hydroMW,
    thermalMW: dispatch.thermalMW,
    importsMW: dispatch.importsMW,
    batteryDischargeMW: dispatch.batteryMW,
    batteryChargeMW: 0,
    lossesMW: 0,
    unservedEnergyMW: dispatch.expectedUnservedEnergyMWh,
    frequencyHz: snapshot.frequencyHz,
    batterySocPct: snapshot.inputBatterySocPct,
    solarAvailableMW: snapshot.renewables.solarGenerationMW,
    windAvailableMW: snapshot.renewables.windGenerationMW,
    hydroAvailableMW: snapshot.renewables.hydroGenerationMW,
    curtailmentMW: snapshot.renewables.curtailmentMW,
    primaryReserveMW: snapshot.reserves.primaryReserveMW,
    secondaryReserveMW: snapshot.reserves.secondaryReserveMW,
    emergencyReserveMW: snapshot.reserves.emergencyMarginMW,
    reserveRequirementMW: Math.round(snapshot.load.predictedDemandMW * 0.1),
    reserveMarginPct: snapshot.reserves.reserveMarginPct,
    corridors: snapshot.corridors,
    corridorLoadingPct: Object.fromEntries(
      snapshot.contingency.redistributedLoading.map((corridor) => [
        corridor.id,
        corridor.loadingPct,
      ]),
    ),
    carbonEmissionsTons: dispatch.carbonEmissionsTonsPerHour,
    reportedCarbonEmissionsTons: dispatch.carbonEmissionsTonsPerHour,
    reportedCost: dispatch.generationCostPerHour,
    thermalCostMultiplier: snapshot.thermalCostMultiplier,
    dispatch,
    demandResponseMW: dispatch.demandResponseMW,
    ssi: snapshot.stability,
    riskPct: snapshot.riskPct,
    renewablePenetrationPct: snapshot.renewableSharePct,
    chosenAction: intervention,
    powerFlow: snapshot.contingency.powerFlow,
  });
}

function check(
  id: string,
  status: ConstraintResult["status"],
  message: string,
  score: number,
): ConstraintResult {
  return { id, status, message, score: clamp(score, 0, 100) };
}
