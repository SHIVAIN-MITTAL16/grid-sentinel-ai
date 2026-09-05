import type { DispatchOptimizationResult } from "./dispatch-optimizer";
import type { ExplainabilityReason } from "./types";

export interface ExplainabilityInput {
  readonly batterySocPct: number;
  readonly windForecastConfidencePct: number;
  readonly reserveDeficiencyMW: number;
  readonly congestionMW: number;
  readonly dispatch: DispatchOptimizationResult;
}

export interface ExplainabilityResult {
  readonly reasons: readonly ExplainabilityReason[];
  readonly confidenceScorePct: number;
}

/** Produces deterministic, traceable statements from dispatch constraints and outcomes. */
export function explainDispatch(input: ExplainabilityInput): ExplainabilityResult {
  const reasons: ExplainabilityReason[] = [];
  if (input.batterySocPct < 25)
    reasons.push({
      code: "battery_soc",
      message: "Battery dispatch constrained because state of charge is below 25%.",
      confidence: 96,
    });
  if (input.reserveDeficiencyMW > 0)
    reasons.push({
      code: "reserve_deficit",
      message:
        "Thermal generation selected because available reserve is below the security requirement.",
      confidence: 94,
    });
  if (input.windForecastConfidencePct < 65)
    reasons.push({
      code: "wind_uncertainty",
      message: "Wind contribution discounted because forecast confidence is low.",
      confidence: 88,
    });
  if (input.congestionMW > 0)
    reasons.push({
      code: "congestion",
      message: "Dispatch limited by post-contingency transmission congestion.",
      confidence: 93,
    });
  if (input.dispatch.carbonEmissionsTonsPerHour > input.dispatch.hydroMW * 0.5)
    reasons.push({
      code: "carbon",
      message: "Thermal dispatch increased carbon emissions to preserve supply adequacy.",
      confidence: 91,
    });
  if (reasons.length === 0)
    reasons.push({
      code: "security",
      message:
        "Available low-carbon resources satisfied demand and reserve requirements without a binding security constraint.",
      confidence: 90,
    });
  const confidenceScorePct = Math.round(
    reasons.reduce((sum, reason) => sum + reason.confidence, 0) / reasons.length,
  );
  return { reasons, confidenceScorePct };
}
