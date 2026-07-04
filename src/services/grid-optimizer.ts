import { getNationalGridSnapshot } from "./grid-snapshot";
import { runMonteCarloSimulation } from "./monte-carlo";

type NationalGridSnapshot = Awaited<ReturnType<typeof getNationalGridSnapshot>>;
type StateSnapshot = NationalGridSnapshot["states"][number];
type MonteCarloResult = ReturnType<typeof runMonteCarloSimulation>;

const RESERVE_MARGIN_TARGET_PERCENT = 15;
const RESERVE_MARGIN_CRITICAL_PERCENT = 5;
const HIGH_STRESS_THRESHOLD = 70;
const ELEVATED_STRESS_THRESHOLD = 50;
const LOW_CONFIDENCE_THRESHOLD = 70;
const HIGH_BLACKOUT_PROBABILITY = 20;
const DEMAND_RESPONSE_SHARE = 0.08;
const BATTERY_DISPATCH_SHARE = 0.65;
const RESERVE_PROCUREMENT_SHARE = 1.1;
const RENEWABLE_CURTAILMENT_THRESHOLD_PERCENT = 70;
const RENEWABLE_CURTAILMENT_SHARE = 0.04;
const SCORE_DENOMINATOR = 100;
const ROUND_MW_SCALE = 10;
const ROUND_PERCENT_SCALE = 10;

interface GridOptimizerInput {
  readonly snapshot: NationalGridSnapshot;
  readonly monteCarlo?: MonteCarloResult;
}

interface OptimizationAction {
  readonly id: string;
  readonly state: string;
  readonly priority: "critical" | "high" | "medium" | "low";
  readonly action:
    | "dispatch_battery"
    | "activate_demand_response"
    | "procure_reserve"
    | "curtail_renewables"
    | "monitor";
  readonly targetMw: number;
  readonly reason: string;
  readonly expectedReserveMarginImpact: number;
}

interface GridOptimizationResult {
  readonly generatedAt: string;
  readonly systemPriority: "critical" | "high" | "medium" | "low";
  readonly recommendedActions: readonly OptimizationAction[];
  readonly totalBatteryDispatchMw: number;
  readonly totalDemandResponseMw: number;
  readonly totalReserveProcurementMw: number;
  readonly totalRenewableCurtailmentMw: number;
  readonly projectedReserveMarginPercent: number;
  readonly residualRiskScore: number;
}

/**
 * Produces deterministic dispatch recommendations from snapshot risk and optional Monte Carlo results.
 */
export function optimizeGridDispatch(input: GridOptimizerInput): GridOptimizationResult {
  const actions = rankActions(
    input.snapshot.states.flatMap((state) => buildStateActions(state, input)),
  );
  const projectedReserveMarginPercent = calculateProjectedReserveMargin(input.snapshot, actions);

  return {
    generatedAt: new Date().toISOString(),
    systemPriority: calculateSystemPriority(input.snapshot, input.monteCarlo),
    recommendedActions: actions,
    totalBatteryDispatchMw: sumActionMw(actions, "dispatch_battery"),
    totalDemandResponseMw: sumActionMw(actions, "activate_demand_response"),
    totalReserveProcurementMw: sumActionMw(actions, "procure_reserve"),
    totalRenewableCurtailmentMw: sumActionMw(actions, "curtail_renewables"),
    projectedReserveMarginPercent,
    residualRiskScore: calculateResidualRisk(
      input.snapshot,
      projectedReserveMarginPercent,
      input.monteCarlo,
    ),
  };
}

function buildStateActions(
  state: StateSnapshot,
  input: GridOptimizerInput,
): readonly OptimizationAction[] {
  return [
    buildBatteryAction(state),
    buildDemandResponseAction(state),
    buildReserveAction(state, input.monteCarlo),
    buildCurtailmentAction(state),
    buildMonitorAction(state),
  ].filter((action): action is OptimizationAction => action !== null);
}

function buildBatteryAction(state: StateSnapshot): OptimizationAction | null {
  if (state.energy.reserveMarginPercent >= RESERVE_MARGIN_TARGET_PERCENT) return null;
  const targetMw = roundMw((state.energy.batteryAvailableMwh / 4) * BATTERY_DISPATCH_SHARE);

  return createAction(
    state,
    "dispatch_battery",
    targetMw,
    "Battery support improves near-term reserve margin.",
  );
}

function buildDemandResponseAction(state: StateSnapshot): OptimizationAction | null {
  if (state.energy.gridStressIndex < ELEVATED_STRESS_THRESHOLD) return null;
  const targetMw = roundMw(state.demand.estimatedLoadMw * DEMAND_RESPONSE_SHARE);

  return createAction(
    state,
    "activate_demand_response",
    targetMw,
    "Demand response reduces stressed peak load.",
  );
}

function buildReserveAction(
  state: StateSnapshot,
  monteCarlo?: MonteCarloResult,
): OptimizationAction | null {
  const reserveShortfallMw = calculateReserveShortfallMw(state);
  const blackoutRisk = monteCarlo?.blackoutProbability ?? 0;
  if (reserveShortfallMw <= 0 && blackoutRisk < HIGH_BLACKOUT_PROBABILITY) return null;

  return createAction(
    state,
    "procure_reserve",
    roundMw(
      Math.max(reserveShortfallMw, state.demand.estimatedLoadMw * 0.03) * RESERVE_PROCUREMENT_SHARE,
    ),
    "Reserve procurement covers deterministic and probabilistic supply shortfall.",
  );
}

function buildCurtailmentAction(state: StateSnapshot): OptimizationAction | null {
  if (state.energy.renewablePenetrationPercent < RENEWABLE_CURTAILMENT_THRESHOLD_PERCENT)
    return null;
  const targetMw = roundMw(state.energy.netRenewableGenerationMw * RENEWABLE_CURTAILMENT_SHARE);

  return createAction(
    state,
    "curtail_renewables",
    targetMw,
    "Renewable curtailment protects operations under surplus conditions.",
  );
}

function buildMonitorAction(state: StateSnapshot): OptimizationAction | null {
  const shouldMonitor =
    state.energy.gridStressIndex < ELEVATED_STRESS_THRESHOLD &&
    state.demand.demandConfidenceScore >= LOW_CONFIDENCE_THRESHOLD;
  if (!shouldMonitor) return null;

  return createAction(state, "monitor", 0, "State remains within modeled operating envelope.");
}

function createAction(
  state: StateSnapshot,
  action: OptimizationAction["action"],
  targetMw: number,
  reason: string,
): OptimizationAction {
  return {
    id: `${state.state}:${action}`,
    state: state.state,
    priority: calculateActionPriority(state),
    action,
    targetMw,
    reason,
    expectedReserveMarginImpact: calculateReserveImpact(targetMw, state.demand.estimatedLoadMw),
  };
}

function calculateActionPriority(state: StateSnapshot): OptimizationAction["priority"] {
  if (state.energy.reserveMarginPercent < RESERVE_MARGIN_CRITICAL_PERCENT) return "critical";
  if (state.energy.gridStressIndex >= HIGH_STRESS_THRESHOLD) return "high";
  if (state.energy.gridStressIndex >= ELEVATED_STRESS_THRESHOLD) return "medium";
  return "low";
}

function calculateReserveShortfallMw(state: StateSnapshot): number {
  const targetReserveMw =
    state.demand.estimatedLoadMw * (RESERVE_MARGIN_TARGET_PERCENT / SCORE_DENOMINATOR);
  const actualReserveMw =
    state.demand.estimatedLoadMw * (state.energy.reserveMarginPercent / SCORE_DENOMINATOR);

  return Math.max(0, targetReserveMw - actualReserveMw);
}

function calculateReserveImpact(targetMw: number, demandMw: number): number {
  return demandMw > 0 ? roundPercent((targetMw / demandMw) * SCORE_DENOMINATOR) : 0;
}

function rankActions(actions: readonly OptimizationAction[]): readonly OptimizationAction[] {
  return [...actions].sort(
    (a, b) => priorityRank(b.priority) - priorityRank(a.priority) || b.targetMw - a.targetMw,
  );
}

function priorityRank(priority: OptimizationAction["priority"]): number {
  const ranks = { critical: 4, high: 3, medium: 2, low: 1 };
  return ranks[priority];
}

function calculateSystemPriority(
  snapshot: NationalGridSnapshot,
  monteCarlo?: MonteCarloResult,
): GridOptimizationResult["systemPriority"] {
  if (snapshot.nationalReserveMarginPercent < RESERVE_MARGIN_CRITICAL_PERCENT) return "critical";
  if ((monteCarlo?.blackoutProbability ?? 0) >= HIGH_BLACKOUT_PROBABILITY) return "high";
  if (snapshot.nationalGridStressIndex >= ELEVATED_STRESS_THRESHOLD) return "medium";
  return "low";
}

function calculateProjectedReserveMargin(
  snapshot: NationalGridSnapshot,
  actions: readonly OptimizationAction[],
): number {
  const supportMw = sum(actions, (action) =>
    action.action === "curtail_renewables" ? -action.targetMw : action.targetMw,
  );
  const supportPercent =
    snapshot.nationalDemandMw > 0 ? (supportMw / snapshot.nationalDemandMw) * SCORE_DENOMINATOR : 0;

  return roundPercent(snapshot.nationalReserveMarginPercent + supportPercent);
}

function calculateResidualRisk(
  snapshot: NationalGridSnapshot,
  projectedReserveMarginPercent: number,
  monteCarlo?: MonteCarloResult,
): number {
  const stressRisk = snapshot.nationalGridStressIndex * 0.45;
  const reserveRisk =
    (SCORE_DENOMINATOR - clamp(projectedReserveMarginPercent * 5, 0, SCORE_DENOMINATOR)) * 0.35;
  const probabilisticRisk = (monteCarlo?.blackoutProbability ?? 0) * 0.2;

  return toScore(stressRisk + reserveRisk + probabilisticRisk);
}

function sumActionMw(
  actions: readonly OptimizationAction[],
  actionType: OptimizationAction["action"],
): number {
  return roundMw(sum(actions, (action) => (action.action === actionType ? action.targetMw : 0)));
}

function sum<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function roundMw(value: number): number {
  return Math.round(value * ROUND_MW_SCALE) / ROUND_MW_SCALE;
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
