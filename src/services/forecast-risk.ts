import { fetchIndianStateCapitalWeather } from "./weather-service";
import { buildNationalGridSnapshot } from "./grid-engine";
import { runMonteCarloSimulation } from "./monte-carlo";

export const PRE_CRISIS_THRESHOLD_PERCENT = 20;
export const FORECAST_HORIZON_HOURS = 24;

export interface ForecastRiskAssessment {
  readonly generatedAt: string;
  readonly horizonHours: number;
  readonly thresholdPercent: number;
  readonly projectedShortfallProbabilityPercent: number;
  readonly baselineMonteCarloProbabilityPercent: number;
  readonly highestRiskState: string;
  readonly forecastHazardScore: number;
  readonly trigger: boolean;
  readonly modelNotice: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hazardScore(point: { temperatureCelsius: number; precipitationProbabilityPercent: number; windGustsKmh: number; weatherCode: number }): number {
  const storm = point.weatherCode >= 95 ? 100 : point.weatherCode >= 80 ? 78 : point.weatherCode >= 61 ? 58 : point.weatherCode >= 51 ? 34 : 0;
  const heat = clamp(((point.temperatureCelsius - 32) / 14) * 100, 0, 100);
  const wind = clamp(((point.windGustsKmh - 35) / 65) * 100, 0, 100);
  return Math.round(storm * 0.45 + point.precipitationProbabilityPercent * 0.25 + heat * 0.2 + wind * 0.1);
}

/**
 * Combines the existing seeded Monte Carlo baseline with the maximum forecast hazard
 * over the next 24 hours. This adjustment is a heuristic, not a calibrated probability
 * until it is back-tested against historical grid events.
 */
export async function evaluateForecastRisk(): Promise<ForecastRiskAssessment> {
  const weather = await fetchIndianStateCapitalWeather();
  const snapshot = buildNationalGridSnapshot(weather);
  if (!snapshot.states.length || !weather.length) throw new Error("Risk evaluation requires grid and forecast data.");

  const monteCarlo = runMonteCarloSimulation(snapshot);
  const stateRisk = weather.map((item) => {
    const forecast = item.hourly.slice(0, FORECAST_HORIZON_HOURS);
    if (forecast.length < 6) throw new Error("Forecast data is incomplete; at least six hourly points are required.");
    const maxHazard = Math.max(...forecast.map(hazardScore));
    const gridState = snapshot.states.find((state) => state.state === item.location.state);
    const currentStress = gridState?.metrics.stormRisk ?? 0;
    const heatStress = gridState?.metrics.heatStress ?? 0;
    const combinedHazard = clamp(maxHazard * 0.75 + currentStress * 0.15 + heatStress * 0.1, 0, 100);
    return { state: item.location.state, hazard: combinedHazard };
  }).sort((a, b) => b.hazard - a.hazard);

  const peakHazard = stateRisk[0]?.hazard ?? 0;
  const projected = clamp(monteCarlo.blackoutProbability + peakHazard * 0.25, 0, 100);
  return {
    generatedAt: new Date().toISOString(),
    horizonHours: FORECAST_HORIZON_HOURS,
    thresholdPercent: PRE_CRISIS_THRESHOLD_PERCENT,
    projectedShortfallProbabilityPercent: Math.round(projected * 10) / 10,
    baselineMonteCarloProbabilityPercent: monteCarlo.blackoutProbability,
    highestRiskState: stateRisk[0]?.state ?? "Unknown",
    forecastHazardScore: Math.round(peakHazard),
    trigger: projected >= PRE_CRISIS_THRESHOLD_PERCENT,
    modelNotice: "Heuristic forecast-adjusted risk estimate; not a calibrated or operator-certified shortfall probability.",
  };
}
