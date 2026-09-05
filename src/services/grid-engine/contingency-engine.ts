import {
  analyseDcContingency,
  rankNMinusOne,
  solveDcPowerFlow,
  type DcContingencyResult,
} from "./dc-power-flow";
import type { ElectricalNetwork } from "./network-model";

export interface CorridorSecurityResult {
  readonly id: string;
  readonly loadingPct: number;
  readonly congestionMW: number;
  readonly overloadProbabilityPct: number;
  readonly status: "secure" | "watch" | "critical" | "overload" | "tripped";
}

/** DC-flow-backed N-1 security result used by the simulation pipeline. */
export interface ContingencyResult {
  readonly failedCorridorId: string;
  readonly redistributedLoading: readonly CorridorSecurityResult[];
  readonly newCongestionMW: number;
  readonly probabilityOfOverloadPct: number;
  readonly criticalCorridors: readonly string[];
  readonly powerFlow: ReturnType<typeof solveDcPowerFlow>;
  readonly mostCriticalContingency: DcContingencyResult;
  readonly topContingencies: readonly DcContingencyResult[];
  readonly securityPenalty: number;
  readonly isIslanded: boolean;
  readonly disconnectedBusGroups: readonly (readonly string[])[];
}

/** Solves the intact network and ranks all eligible single-line DC contingencies. */
export function evaluateBaseSecurity(network: ElectricalNetwork): ContingencyResult {
  const base = solveDcPowerFlow(network);
  const ranking = rankNMinusOne(network);
  return toSecurityResult(base, ranking, "none", undefined);
}

/** Removes one line and re-solves B' theta = P; no fixed redistribution percentages are used. */
export function analyseNMinusOne(
  network: ElectricalNetwork,
  failedCorridorId: string,
): ContingencyResult {
  const post = analyseDcContingency(network, failedCorridorId);
  const ranking = rankNMinusOne(network);
  return toSecurityResult(post.postContingencyFlows, ranking, failedCorridorId, post);
}

function toSecurityResult(
  powerFlow: ReturnType<typeof solveDcPowerFlow>,
  ranking: readonly DcContingencyResult[],
  failedCorridorId: string,
  applied: DcContingencyResult | undefined,
): ContingencyResult {
  const redistributedLoading = powerFlow.lineFlows.map((line): CorridorSecurityResult => ({
    id: line.lineId,
    loadingPct: line.loadingPct,
    congestionMW: Math.round(Math.max(0, Math.abs(line.flowMW) - line.thermalLimitMW)),
    overloadProbabilityPct: line.status === "overload" ? 100 : line.status === "watch" ? 50 : 0,
    status: line.status === "safe" ? "secure" : line.status === "watch" ? "watch" : line.status,
  }));
  const criticalCorridors = redistributedLoading
    .filter((line) => line.status === "overload" || line.status === "critical")
    .map((line) => line.id);
  const maximumLoading = Math.max(...redistributedLoading.map((line) => line.loadingPct));
  return {
    failedCorridorId,
    redistributedLoading,
    newCongestionMW: redistributedLoading.reduce((sum, line) => sum + line.congestionMW, 0),
    probabilityOfOverloadPct: maximumLoading > 100 ? 100 : maximumLoading >= 80 ? 50 : 0,
    criticalCorridors,
    powerFlow,
    mostCriticalContingency: ranking[0],
    topContingencies: ranking.slice(0, 3),
    securityPenalty: applied?.securityPenalty ?? 0,
    isIslanded: powerFlow.isIslanded,
    disconnectedBusGroups: powerFlow.disconnectedBusGroups,
  };
}
