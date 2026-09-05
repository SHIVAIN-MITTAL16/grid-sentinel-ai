import { analyseDcContingency, solveDcPowerFlow } from "./dc-power-flow";
import type { ElectricalNetwork } from "./network-model";

/** Focused deterministic verification for the small DC solver; no test framework is required. */
export function runNetworkPhysicsVerification() {
  const triangular: ElectricalNetwork = {
    baseMVA: 100,
    slackBusId: "b2",
    buses: [
      { id: "b1", name: "Source", region: "north", generationMW: 100, loadMW: 0 },
      { id: "b2", name: "Slack", region: "north", generationMW: 0, loadMW: 0 },
      { id: "b3", name: "Load", region: "north", generationMW: 0, loadMW: 100 },
    ],
    lines: [
      {
        id: "b1-b2",
        fromBus: "b1",
        toBus: "b2",
        reactancePu: 0.1,
        thermalLimitMW: 55,
        status: true,
      },
      {
        id: "b2-b3",
        fromBus: "b2",
        toBus: "b3",
        reactancePu: 0.1,
        thermalLimitMW: 55,
        status: true,
      },
      {
        id: "b1-b3",
        fromBus: "b1",
        toBus: "b3",
        reactancePu: 0.2,
        thermalLimitMW: 45,
        status: true,
      },
    ],
  };
  const base = solveDcPowerFlow(triangular);
  const outage = analyseDcContingency(triangular, "b1-b3");
  const radial: ElectricalNetwork = {
    ...triangular,
    lines: triangular.lines.filter((line) => line.id !== "b1-b3"),
  };
  const island = analyseDcContingency(radial, "b2-b3");
  const baseDirection = base.lineFlows.find((line) => line.lineId === "b1-b3")?.flowMW ?? 0;
  const outageTripped = outage.postContingencyFlows.lineFlows.find(
    (line) => line.lineId === "b1-b3",
  );
  return {
    balancedThreeBus: Math.abs(base.totalInjectionMW) < 1e-9 && base.solved,
    knownFlowDirection: baseDirection > 0,
    redistribution: outage.postContingencyFlows.solved && outage.maximumLoadingPct > 100,
    thermalOverload: outage.overloadedLines.length > 0,
    slackReference: base.busAnglesRad.b2 === 0,
    trippedLineZeroFlow: outageTripped?.flowMW === 0,
    islandDetected: island.isIslanded && !island.postContingencyFlows.solved,
  };
}
