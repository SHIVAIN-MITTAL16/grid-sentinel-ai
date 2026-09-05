import { clamp } from "./types";

export interface ReliabilityIndexInput {
  readonly frequencyHz: number;
  readonly reserveMarginPct: number;
  readonly congestionPct: number;
  readonly expectedEnergyNotServedMWh: number;
  readonly demandMW: number;
  readonly renewablePenetrationPct: number;
  readonly riskPct: number;
}

export interface SentinelStabilityIndex {
  readonly score: number;
  readonly grade: "Excellent" | "Good" | "Warning" | "Critical";
  readonly components: Readonly<
    Record<"frequency" | "reserve" | "congestion" | "ens" | "renewables" | "risk", number>
  >;
}

/**
 * Sentinel Stability Index (SSI), 0–100:
 * 24% frequency containment + 22% reserve + 18% congestion + 18% EENS + 8% renewable quality + 10% risk.
 * Renewable quality rewards penetration until 60%; extreme penetration is not rewarded beyond that without flexibility data.
 */
export function calculateSentinelStabilityIndex(
  input: ReliabilityIndexInput,
): SentinelStabilityIndex {
  const frequency = clamp(100 - (Math.abs(input.frequencyHz - 50) / 1.1) * 100, 0, 100);
  const reserve = clamp(((input.reserveMarginPct + 5) / 20) * 100, 0, 100);
  const congestion = clamp(100 - (Math.max(0, input.congestionPct - 65) / 45) * 100, 0, 100);
  const ensFraction = input.expectedEnergyNotServedMWh / Math.max(1, input.demandMW);
  const ens = clamp(100 - ensFraction * 10000, 0, 100);
  const renewables = clamp((input.renewablePenetrationPct / 60) * 100, 0, 100);
  const risk = clamp(100 - input.riskPct, 0, 100);
  const score = Math.round(
    frequency * 0.24 +
      reserve * 0.22 +
      congestion * 0.18 +
      ens * 0.18 +
      renewables * 0.08 +
      risk * 0.1,
  );
  const grade =
    score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 45 ? "Warning" : "Critical";
  return {
    score,
    grade,
    components: {
      frequency: Math.round(frequency),
      reserve: Math.round(reserve),
      congestion: Math.round(congestion),
      ens: Math.round(ens),
      renewables: Math.round(renewables),
      risk: Math.round(risk),
    },
  };
}
