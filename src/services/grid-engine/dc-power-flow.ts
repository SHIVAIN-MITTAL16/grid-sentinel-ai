import type { ElectricalNetwork } from "./network-model";
import type { PowerFlowResult, TransmissionLine } from "./types";

export interface DcContingencyResult {
  readonly outagedLine: string;
  readonly postContingencyFlows: PowerFlowResult;
  readonly overloadedLines: readonly string[];
  readonly maximumLoadingPct: number;
  readonly numberOfViolations: number;
  readonly isIslanded: boolean;
  readonly disconnectedBusGroups: readonly (readonly string[])[];
  readonly islandImbalanceMW: Readonly<Record<string, number>>;
  readonly securityPenalty: number;
  readonly severity: number;
}

/** Lossless DC power flow: P_ij = baseMVA * (theta_i - theta_j) / X_ij. */
export function solveDcPowerFlow(network: ElectricalNetwork): PowerFlowResult {
  const activeLines = network.lines.filter((line) => line.status);
  const groups = connectedGroups(
    network.buses.map((bus) => bus.id),
    activeLines,
  );
  const injections = Object.fromEntries(
    network.buses.map((bus) => [bus.id, bus.generationMW - bus.loadMW]),
  );
  const islandImbalanceMW = Object.fromEntries(
    groups.map((group) => [group.join("|"), group.reduce((sum, id) => sum + injections[id], 0)]),
  );
  const isIslanded = groups.length > 1;
  const zeroAngles = Object.fromEntries(network.buses.map((bus) => [bus.id, 0]));
  if (isIslanded) {
    return {
      baseMVA: network.baseMVA,
      slackBusId: network.slackBusId,
      solved: false,
      busAnglesRad: zeroAngles,
      netInjectionMW: injections,
      lineFlows: network.lines.map((line) => lineResult(line, 0, "tripped")),
      totalInjectionMW: sum(Object.values(injections)),
      isIslanded: true,
      disconnectedBusGroups: groups,
      islandImbalanceMW,
    };
  }
  const ids = network.buses.map((bus) => bus.id);
  const slackIndex = ids.indexOf(network.slackBusId);
  if (slackIndex < 0) throw new Error(`Slack bus ${network.slackBusId} is absent.`);
  const B = Array.from({ length: ids.length }, () => Array<number>(ids.length).fill(0));
  for (const line of activeLines) {
    const from = ids.indexOf(line.fromBus);
    const to = ids.indexOf(line.toBus);
    const susceptance = 1 / line.reactancePu;
    B[from][from] += susceptance;
    B[to][to] += susceptance;
    B[from][to] -= susceptance;
    B[to][from] -= susceptance;
  }
  const reducedIndices = ids.map((_, index) => index).filter((index) => index !== slackIndex);
  const reducedB = reducedIndices.map((row) => reducedIndices.map((column) => B[row][column]));
  const reducedP = reducedIndices.map((index) => injections[ids[index]] / network.baseMVA);
  const reducedAngles = solveLinearSystem(reducedB, reducedP);
  const angles: Record<string, number> = { ...zeroAngles };
  for (let index = 0; index < reducedIndices.length; index += 1)
    angles[ids[reducedIndices[index]]] = reducedAngles[index];
  const lineFlows = network.lines.map((line) => {
    if (!line.status) return lineResult(line, 0, "tripped");
    const flowMW =
      (network.baseMVA * (angles[line.fromBus] - angles[line.toBus])) / line.reactancePu;
    return lineResult(line, flowMW);
  });
  return {
    baseMVA: network.baseMVA,
    slackBusId: network.slackBusId,
    solved: true,
    busAnglesRad: angles,
    netInjectionMW: injections,
    lineFlows,
    totalInjectionMW: sum(Object.values(injections)),
    isIslanded: false,
    disconnectedBusGroups: groups,
    islandImbalanceMW,
  };
}

/** Re-solves the B' theta = P system after a single active-line outage. */
export function analyseDcContingency(
  network: ElectricalNetwork,
  outagedLine: string,
): DcContingencyResult {
  const outaged = network.lines.find((line) => line.id === outagedLine);
  if (!outaged) throw new Error(`Unknown transmission line ${outagedLine}.`);
  const postNetwork: ElectricalNetwork = {
    ...network,
    lines: network.lines.map((line) =>
      line.id === outagedLine ? { ...line, status: false } : line,
    ),
  };
  const postContingencyFlows = solveDcPowerFlow(postNetwork);
  const overloadedLines = postContingencyFlows.lineFlows
    .filter((line) => line.status === "overload")
    .map((line) => line.lineId);
  const maximumLoadingPct = Math.max(
    ...postContingencyFlows.lineFlows.map((line) => line.loadingPct),
  );
  // C_line = sum(max(0, |P|/limit - 1)^2); islanding receives an explicit non-arbitrary infeasibility penalty.
  const thermalPenalty = postContingencyFlows.lineFlows.reduce(
    (sumPenalty, line) => sumPenalty + Math.max(0, line.loadingPct / 100 - 1) ** 2,
    0,
  );
  const islandPenalty = postContingencyFlows.isIslanded
    ? 100 +
      Object.values(postContingencyFlows.islandImbalanceMW).reduce(
        (sumMW, value) => sumMW + Math.abs(value),
        0,
      ) /
        network.baseMVA
    : 0;
  const securityPenalty = thermalPenalty + islandPenalty;
  return {
    outagedLine,
    postContingencyFlows,
    overloadedLines,
    maximumLoadingPct,
    numberOfViolations: overloadedLines.length,
    isIslanded: postContingencyFlows.isIslanded,
    disconnectedBusGroups: postContingencyFlows.disconnectedBusGroups,
    islandImbalanceMW: postContingencyFlows.islandImbalanceMW,
    securityPenalty,
    severity: securityPenalty,
  };
}

export function rankNMinusOne(network: ElectricalNetwork): readonly DcContingencyResult[] {
  return network.lines
    .filter((line) => line.status)
    .map((line) => analyseDcContingency(network, line.id))
    .sort(
      (left, right) =>
        right.severity - left.severity || right.maximumLoadingPct - left.maximumLoadingPct,
    );
}

function lineResult(line: TransmissionLine, flowMW: number, forcedStatus?: "tripped") {
  const loadingPct = forcedStatus ? 0 : (Math.abs(flowMW) / line.thermalLimitMW) * 100;
  return {
    lineId: line.id,
    fromBus: line.fromBus,
    toBus: line.toBus,
    flowMW: Math.round(flowMW * 100) / 100,
    loadingPct: Math.round(loadingPct * 100) / 100,
    thermalLimitMW: line.thermalLimitMW,
    status: forcedStatus ?? (loadingPct > 100 ? "overload" : loadingPct >= 80 ? "watch" : "safe"),
  } as const;
}

function connectedGroups(busIds: readonly string[], lines: readonly TransmissionLine[]) {
  const adjacent = new Map(busIds.map((id) => [id, [] as string[]]));
  for (const line of lines) {
    adjacent.get(line.fromBus)?.push(line.toBus);
    adjacent.get(line.toBus)?.push(line.fromBus);
  }
  const visited = new Set<string>();
  const groups: string[][] = [];
  for (const start of busIds) {
    if (visited.has(start)) continue;
    const group: string[] = [];
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      const current = stack.pop()!;
      group.push(current);
      for (const next of adjacent.get(current) ?? [])
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
    }
    groups.push(group);
  }
  return groups;
}

/** Small pivoted Gaussian elimination is sufficient and deterministic for the reduced five-bus matrix. */
function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row += 1)
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    if (Math.abs(augmented[best][pivot]) < 1e-12) throw new Error("Singular DC power-flow matrix.");
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    const scale = augmented[pivot][pivot];
    for (let column = pivot; column <= n; column += 1) augmented[pivot][column] /= scale;
    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= n; column += 1)
        augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row[n]);
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}
