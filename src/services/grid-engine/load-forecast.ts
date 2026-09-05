import { boundedHour, clamp } from "./types";

export interface LoadForecastInput {
  readonly hour: number;
  readonly temperatureC: number;
  readonly weekday: number;
  readonly industrialCoefficient: number;
  readonly populationFactor: number;
  readonly baseDemandMW: number;
}

export interface LoadForecastResult {
  readonly predictedDemandMW: number;
  readonly forecastErrorMW: number;
  readonly confidenceIntervalMW: readonly [number, number];
}

/**
 * Demand = base × population × industrial × daily-shape × thermal-stress.
 * Thermal stress is a cooling/heating degree response around a 24°C comfort point.
 */
export function forecastLoad(input: LoadForecastInput): LoadForecastResult {
  const hour = boundedHour(input.hour);
  const eveningPeak = 0.19 * Math.exp(-((hour - 20) ** 2) / 10);
  const morningPeak = 0.08 * Math.exp(-((hour - 9) ** 2) / 11);
  const nightTrough = 0.16 * Math.exp(-((hour - 3) ** 2) / 12);
  const dailyShape = 1 + eveningPeak + morningPeak - nightTrough;
  const coolingStress = Math.max(0, input.temperatureC - 24) * 0.018;
  const heatingStress = Math.max(0, 18 - input.temperatureC) * 0.012;
  const weekdayFactor = input.weekday >= 1 && input.weekday <= 5 ? 1 : 0.93;
  const predictedDemandMW = Math.round(
    input.baseDemandMW *
      input.populationFactor *
      input.industrialCoefficient *
      weekdayFactor *
      dailyShape *
      (1 + coolingStress + heatingStress),
  );
  // Error increases away from the comfort range and at the morning/evening ramps.
  const errorFraction =
    0.025 + Math.abs(input.temperatureC - 24) * 0.002 + (morningPeak + eveningPeak) * 0.04;
  const forecastErrorMW = Math.round(predictedDemandMW * errorFraction);
  return {
    predictedDemandMW,
    forecastErrorMW,
    confidenceIntervalMW: [
      predictedDemandMW - forecastErrorMW * 2,
      predictedDemandMW + forecastErrorMW * 2,
    ],
  };
}
