import {
  runSimulationPipeline,
  type OperatorIntervention,
} from "@/services/grid-engine/simulation-pipeline";
import { validateGrid } from "@/services/grid-validation";
import type {
  ActionId,
  Comparison,
  NightShiftEvent,
  NightShiftState,
  OperatorAction,
  Outcome,
} from "./types";

export const ACTIONS: readonly OperatorAction[] = [
  {
    id: "hold",
    label: "A — HOLD / MONITOR",
    shortLabel: "Hold / Monitor",
    description: "Preserve resources while the Grid Engine forecasts the contingency.",
  },
  {
    id: "bess",
    label: "B — DISPATCH BESS",
    shortLabel: "BESS dispatch",
    description: "Prioritize available storage through the dispatch optimizer.",
  },
  {
    id: "thermal",
    label: "C — INCREASE THERMAL GENERATION",
    shortLabel: "Thermal surge",
    description: "Prioritize thermal commitment through the dispatch optimizer.",
  },
  {
    id: "demand-response",
    label: "D — ACTIVATE DEMAND RESPONSE",
    shortLabel: "Demand response",
    description: "Prioritize flexible demand response through the dispatch optimizer.",
  },
] as const;

export const EVENTS: readonly NightShiftEvent[] = [
  {
    id: "solar-drop",
    number: 1,
    title: "RAJASTHAN SOLAR DROP",
    location: "NORTH-WEST SOLAR FLEET",
    cause: "Fast-moving cloud system",
    severity: "ELEVATED",
    message: "Western reserve degradation detected.",
  },
  {
    id: "transmission-trip",
    number: 2,
    title: "TRANSMISSION CONTINGENCY",
    location: "MAHARASHTRA ↔ GUJARAT CORRIDOR",
    cause: "LINE TRIPPED",
    severity: "HIGH",
    message: "Security envelope deteriorating.",
  },
  {
    id: "cascade",
    number: 3,
    title: "CASCADE EVENT",
    location: "WESTERN GRID",
    cause: "Heatwave · renewable reduction · generator trip",
    severity: "S-TIER",
    message: "Intervention available. Limited decision window active.",
  },
] as const;

/** Entry point: baseline state is generated through the complete Grid Engine pipeline. */
export function createInitialState(): NightShiftState {
  return buildState("base", "hold", 0, 82, 0, 1000, 0, 0, null);
}

/** Event application selects a weather/asset scenario; no dashboard field is directly mutated. */
export function applyEvent(before: NightShiftState, event: NightShiftEvent): NightShiftState {
  return buildState(
    event.id,
    "hold",
    before.timeMinutes + 12,
    before.batterySocPct,
    before.operatingCost,
    before.score,
    before.peakRisk,
    before.cumulativeUnservedMWh,
    event,
  );
}

/** Every operator control is an optimizer intervention mode; its outputs become the next state. */
export function evaluateAction(state: NightShiftState, actionId: ActionId): Outcome {
  const action = ACTIONS.find((candidate) => candidate.id === actionId)!;
  const next = buildState(
    state.scenario,
    actionToIntervention(actionId),
    state.timeMinutes + 8,
    state.batterySocPct,
    state.operatingCost,
    state.score,
    state.peakRisk,
    state.cumulativeUnservedMWh,
    state.currentEvent,
  );
  return {
    state: next,
    objective: objectiveFor(next),
    reliability: Math.max(0, Math.round(next.ssi - next.unservedLoadMW / 160)),
    action,
  };
}

/** Lower J is preferable. Existing Night Shift weights are preserved. */
export function objectiveFor(state: NightShiftState): number {
  const reliabilityPenalty = 100 - Math.max(0, 100 - state.systemRisk - state.unservedLoadMW / 160);
  const normalizedCost = Math.min(100, state.operatingCost / 1800);
  const normalizedCarbon = Math.min(100, state.carbonIntensity / 9);
  const normalizedUnserved = Math.min(100, state.unservedLoadMW / 80);
  return round(
    0.33 * reliabilityPenalty +
      0.14 * normalizedCost +
      0.13 * normalizedCarbon +
      0.25 * normalizedUnserved +
      0.15 * state.systemRisk,
    2,
  );
}

export function resolveDecision(state: NightShiftState, selected: ActionId): Comparison {
  const human = evaluateAction(state, selected);
  const sentinel = ACTIONS.map((action) => evaluateAction(state, action.id)).reduce(
    (best, outcome) => (outcome.objective < best.objective ? outcome : best),
  );
  const rawScore = Math.round(
    (sentinel.objective - human.objective) * 9 +
      human.reliability * 2 -
      human.state.unservedLoadMW / 12 -
      Math.max(0, human.state.lineLoading - 100) * 5,
  );
  const scoreDelta = Math.max(-350, Math.min(420, rawScore));
  const scoredState = { ...human.state, score: Math.max(0, state.score + scoreDelta) };
  return {
    human: { ...human, state: scoredState },
    sentinel,
    scoreDelta,
    scoreBreakdown: [
      { label: "RELIABILITY", value: Math.round(human.reliability * 3.2) },
      { label: "FAST RESPONSE", value: selected === sentinel.action.id ? 180 : 70 },
      { label: "RENEWABLE RETENTION", value: Math.round(human.state.renewableShare * 1.2) },
      {
        label: "COST EFFICIENCY",
        value: Math.round(Math.max(-110, 110 - human.state.operatingCost / 18)),
      },
      {
        label: "SECURITY PENALTY",
        value: -Math.round(Math.max(0, human.state.systemRisk - 25) * 3.2),
      },
    ],
  };
}

function buildState(
  scenario: NightShiftState["scenario"],
  intervention: OperatorIntervention,
  timeMinutes: number,
  batterySocPct: number,
  priorCost: number,
  score: number,
  priorPeakRisk: number,
  priorUnservedMWh: number,
  currentEvent: NightShiftEvent | null,
): NightShiftState {
  const pipeline = runSimulationPipeline({ scenario, intervention, timeMinutes, batterySocPct });
  const dispatch = pipeline.dispatch;
  const frequencyHz =
    Math.round(
      (50 +
        dispatch.estimatedFrequencyDeviationHz -
        Math.max(0, pipeline.lineLoadingPct - 100) * 0.004) *
        100,
    ) / 100;
  const validationResult = validateGrid({
    demandMW: pipeline.load.predictedDemandMW,
    solarMW: pipeline.renewables.solarGenerationMW,
    windMW: pipeline.renewables.windGenerationMW,
    hydroMW: dispatch.hydroMW,
    thermalMW: dispatch.thermalMW,
    importsMW: dispatch.importsMW,
    batteryDischargeMW: dispatch.batteryMW,
    batteryChargeMW: 0,
    lossesMW: 0,
    unservedEnergyMW: dispatch.expectedUnservedEnergyMWh,
    frequencyHz,
    batterySocPct: pipeline.renewables.batterySocPct,
    solarAvailableMW: pipeline.renewables.solarGenerationMW,
    windAvailableMW: pipeline.renewables.windGenerationMW,
    hydroAvailableMW: pipeline.renewables.hydroGenerationMW,
    curtailmentMW: pipeline.renewables.curtailmentMW,
    primaryReserveMW: pipeline.reserves.primaryReserveMW,
    secondaryReserveMW: pipeline.reserves.secondaryReserveMW,
    emergencyReserveMW: pipeline.reserves.emergencyMarginMW,
    reserveRequirementMW: Math.round(pipeline.load.predictedDemandMW * 0.1),
    reserveMarginPct: pipeline.reserves.reserveMarginPct,
    corridors: pipeline.corridors,
    corridorLoadingPct: Object.fromEntries(
      pipeline.contingency.redistributedLoading.map((corridor) => [
        corridor.id,
        corridor.loadingPct,
      ]),
    ),
    carbonEmissionsTons: dispatch.carbonEmissionsTonsPerHour,
    reportedCarbonEmissionsTons: dispatch.carbonEmissionsTonsPerHour,
    reportedCost: dispatch.generationCostPerHour,
    dispatch,
    demandResponseMW: dispatch.demandResponseMW,
    ssi: pipeline.stability,
    riskPct: pipeline.riskPct,
    renewablePenetrationPct: pipeline.renewableSharePct,
    chosenAction: intervention,
  });
  return {
    timeMinutes,
    demandMW: pipeline.load.predictedDemandMW,
    solarMW: pipeline.renewables.solarGenerationMW,
    windMW: pipeline.renewables.windGenerationMW,
    hydroMW: dispatch.hydroMW,
    thermalMW: dispatch.thermalMW,
    batteryMW: dispatch.batteryMW,
    batteryAvailableMW: Math.round((8000 * pipeline.renewables.batterySocPct) / 100),
    availableGenerationMW: pipeline.availableGenerationMW,
    availableCapacityMW: pipeline.availableCapacityMW,
    reserveMW: pipeline.reserves.spinningReserveMW,
    reserveMarginPct: pipeline.reserves.reserveMarginPct,
    frequencyHz,
    unservedLoadMW: dispatch.expectedUnservedEnergyMWh,
    systemRisk: pipeline.riskPct,
    operatingCost: Math.round(priorCost + dispatch.generationCostPerHour / 8),
    carbonIntensity: pipeline.carbonIntensityKgPerMWh,
    carbonImpact: Math.round(dispatch.carbonEmissionsTonsPerHour / 8),
    renewableShare: pipeline.renewableSharePct,
    lineLoading: Math.round(pipeline.lineLoadingPct),
    score,
    peakRisk: Math.max(priorPeakRisk, pipeline.riskPct),
    cumulativeUnservedMWh: priorUnservedMWh + dispatch.expectedUnservedEnergyMWh / 8,
    currentEvent,
    eventSeverity:
      currentEvent?.severity === "S-TIER"
        ? 92
        : currentEvent?.severity === "HIGH"
          ? 58
          : currentEvent
            ? 34
            : 0,
    scenario,
    batterySocPct: pipeline.renewables.batterySocPct,
    ssi: pipeline.stability.score,
    ssiGrade: pipeline.stability.grade,
    expectedUnservedEnergyMWh: dispatch.expectedUnservedEnergyMWh,
    operatorConfidencePct: pipeline.explanation.confidenceScorePct,
    networkBuses: pipeline.networkBuses,
    networkPowerFlow: pipeline.contingency.powerFlow,
    networkTopContingencies: pipeline.contingency.topContingencies,
    controlEnvelopeStatus: pipeline.controlEnvelopeStatus,
    sentinelReasons: pipeline.explanation.reasons.slice(0, 3).map((reason) => reason.message),
    validation: {
      overallGrade: validationResult.report.overallGrade,
      validationScore: validationResult.report.validationScore,
      passedConstraints: validationResult.report.passedConstraints,
      brokenConstraints: validationResult.report.brokenConstraints,
      warnings: validationResult.report.warnings,
      confidencePct: validationResult.report.confidencePct,
    },
  };
}

function actionToIntervention(action: ActionId): OperatorIntervention {
  if (action === "bess") return "battery";
  if (action === "thermal") return "thermal";
  if (action === "demand-response") return "demand-response";
  return "hold";
}
function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
