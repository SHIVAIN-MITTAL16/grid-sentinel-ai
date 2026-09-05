import type { Bus, GridRegion, TransmissionLine } from "./types";

export interface RepresentativeNetworkInput {
  readonly demandMW: number;
  readonly solarMW: number;
  readonly windMW: number;
  readonly hydroMW: number;
  readonly thermalMW: number;
  readonly batteryMW: number;
  readonly importsMW: number;
  readonly demandResponseMW: number;
  readonly unservedLoadMW: number;
}

export interface ElectricalNetwork {
  readonly baseMVA: number;
  readonly slackBusId: string;
  readonly buses: readonly Bus[];
  readonly lines: readonly TransmissionLine[];
}

const REGION: Readonly<Record<string, GridRegion>> = {
  rajasthan: "north",
  gujarat: "west",
  maharashtra: "west",
  "madhya-pradesh": "north",
  delhi: "north",
};

const BUS_DEFINITIONS = [
  ["rajasthan", "Rajasthan", 0.14],
  ["gujarat", "Gujarat", 0.16],
  ["maharashtra", "Maharashtra", 0.3],
  ["madhya-pradesh", "Madhya Pradesh", 0.22],
  ["delhi", "Delhi", 0.18],
] as const;

/**
 * Representative five-bus inter-regional model. It is deliberately compact and is not the
 * complete Indian transmission network. Parallel paths make N-1 redistribution observable.
 */
export const REPRESENTATIVE_LINES: readonly TransmissionLine[] = [
  {
    id: "rajasthan-gujarat",
    fromBus: "rajasthan",
    toBus: "gujarat",
    reactancePu: 0.12,
    thermalLimitMW: 9500,
    status: true,
  },
  {
    id: "gujarat-maharashtra",
    fromBus: "gujarat",
    toBus: "maharashtra",
    reactancePu: 0.1,
    thermalLimitMW: 11500,
    status: true,
  },
  {
    id: "mumbai-mp",
    fromBus: "maharashtra",
    toBus: "madhya-pradesh",
    reactancePu: 0.11,
    thermalLimitMW: 9000,
    status: true,
  },
  {
    id: "mp-delhi",
    fromBus: "madhya-pradesh",
    toBus: "delhi",
    reactancePu: 0.1,
    thermalLimitMW: 10000,
    status: true,
  },
  {
    id: "gujarat-mp",
    fromBus: "gujarat",
    toBus: "madhya-pradesh",
    reactancePu: 0.16,
    thermalLimitMW: 7500,
    status: true,
  },
  {
    id: "rajasthan-delhi",
    fromBus: "rajasthan",
    toBus: "delhi",
    reactancePu: 0.22,
    thermalLimitMW: 7000,
    status: true,
  },
];

/** Allocates aggregate pipeline injection to the reduced-order network while preserving total MW balance. */
export function buildRepresentativeNetwork(input: RepresentativeNetworkInput): ElectricalNetwork {
  const effectiveDemandMW = Math.max(
    0,
    input.demandMW - input.demandResponseMW - input.unservedLoadMW,
  );
  const generationByBus: Record<string, number> = {
    rajasthan: input.solarMW * 0.72 + input.windMW * 0.08,
    gujarat: input.solarMW * 0.18 + input.windMW * 0.42 + input.importsMW,
    maharashtra: input.windMW * 0.2 + input.thermalMW * 0.36 + input.batteryMW,
    "madhya-pradesh": input.hydroMW * 0.58 + input.thermalMW * 0.22,
    delhi: input.hydroMW * 0.42 + input.thermalMW * 0.42,
  };
  const buses = BUS_DEFINITIONS.map(([id, name, loadShare]) => ({
    id,
    name,
    region: REGION[id],
    generationMW: generationByBus[id],
    loadMW: effectiveDemandMW * loadShare,
  }));
  // Allocation weights and source terms sum exactly; the final adjustment only removes floating-point residue.
  const residualMW = buses.reduce((sum, bus) => sum + bus.generationMW - bus.loadMW, 0);
  const slackIndex = buses.findIndex((bus) => bus.id === "madhya-pradesh");
  const balancedBuses = buses.map((bus, index) =>
    index === slackIndex ? { ...bus, generationMW: bus.generationMW - residualMW } : bus,
  );
  return {
    baseMVA: 100000,
    slackBusId: "madhya-pradesh",
    buses: balancedBuses,
    lines: REPRESENTATIVE_LINES,
  };
}
