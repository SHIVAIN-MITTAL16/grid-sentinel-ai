import {
  fetchIndianStateCapitalWeather,
  type CapitalWeatherData,
  type WeatherCurrentConditions,
} from "./weather-service";

export interface GridWeatherInputs {
  readonly temperatureCelsius: number;
  readonly cloudCoverPercent: number;
  readonly windSpeedKmh: number;
  readonly precipitationMm: number;
  readonly weatherCode: number;
}

export interface GridStateMetrics {
  readonly solarPotential: number;
  readonly windPotential: number;
  readonly renewableScore: number;
  readonly cloudImpact: number;
  readonly stormRisk: number;
  readonly heatStress: number;
}

export interface GridState {
  readonly state: string;
  readonly capital: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observedAt: string;
  readonly weather: GridWeatherInputs;
  readonly metrics: GridStateMetrics;
}

export interface NationalGridSnapshot {
  readonly generatedAt: string;
  readonly source: "open-meteo";
  readonly states: readonly GridState[];
}

/**
 * Fetches live capital weather and converts it into grid-relevant state metrics.
 */
export async function getNationalGridSnapshot(): Promise<NationalGridSnapshot> {
  const weatherByCapital = await fetchIndianStateCapitalWeather();

  return {
    generatedAt: new Date().toISOString(),
    source: "open-meteo",
    states: weatherByCapital.map(toGridState),
  };
}

function toGridState(weather: CapitalWeatherData): GridState {
  const inputs = toGridWeatherInputs(weather.current);

  return {
    state: weather.location.state,
    capital: weather.location.capital,
    latitude: weather.location.latitude,
    longitude: weather.location.longitude,
    observedAt: weather.current.observedAt,
    weather: inputs,
    metrics: calculateGridMetrics(inputs),
  };
}

function toGridWeatherInputs(current: WeatherCurrentConditions): GridWeatherInputs {
  return {
    temperatureCelsius: current.temperatureCelsius,
    cloudCoverPercent: current.cloudCoverPercent,
    windSpeedKmh: current.windSpeedKmh,
    precipitationMm: current.precipitationMm,
    weatherCode: current.weatherCode,
  };
}

function calculateGridMetrics(inputs: GridWeatherInputs): GridStateMetrics {
  const solarPotential = calculateSolarPotential(inputs);
  const windPotential = calculateWindPotential(inputs.windSpeedKmh);
  const cloudImpact = calculateCloudImpact(inputs.cloudCoverPercent);
  const stormRisk = calculateStormRisk(inputs);
  const heatStress = calculateHeatStress(inputs.temperatureCelsius);

  return {
    solarPotential,
    windPotential,
    renewableScore: calculateRenewableScore({ solarPotential, windPotential, stormRisk }),
    cloudImpact,
    stormRisk,
    heatStress,
  };
}

/**
 * Solar formula:
 * clear-sky potential is reduced by cloud cover, precipitation, weather-code severity,
 * and heat above 25 C because PV modules lose efficiency as cell temperature rises.
 */
function calculateSolarPotential(inputs: GridWeatherInputs): number {
  const clearSkyFactor = 1 - clampPercent(inputs.cloudCoverPercent) / 100;
  const precipitationFactor = 1 - scaleToUnit(inputs.precipitationMm, 0, 10) * 0.45;
  const weatherFactor = 1 - weatherCodeSolarPenalty(inputs.weatherCode);
  const heatFactor = 1 - scaleToUnit(inputs.temperatureCelsius, 25, 45) * 0.18;

  return toScore(100 * clearSkyFactor * precipitationFactor * weatherFactor * heatFactor);
}

/**
 * Wind formula:
 * simplified turbine power curve from 10 km/h cut-in to 45 km/h rated speed,
 * with deterministic derating above 70 km/h to represent high-wind protection.
 */
function calculateWindPotential(windSpeedKmh: number): number {
  const ramp = scaleToUnit(windSpeedKmh, 10, 45);
  const highWindDerate = scaleToUnit(windSpeedKmh, 70, 100) * 0.7;

  return toScore(100 * ramp * (1 - highWindDerate));
}

/**
 * Renewable score formula:
 * combines solar and wind potential, then subtracts storm-related operational risk.
 */
function calculateRenewableScore(metrics: {
  readonly solarPotential: number;
  readonly windPotential: number;
  readonly stormRisk: number;
}): number {
  const generationPotential = metrics.solarPotential * 0.6 + metrics.windPotential * 0.4;
  const stormDerate = metrics.stormRisk * 0.25;

  return toScore(generationPotential - stormDerate);
}

/**
 * Cloud impact formula:
 * direct grid impact from cloud cover, exposed as a 0-100 score.
 */
function calculateCloudImpact(cloudCoverPercent: number): number {
  return toScore(clampPercent(cloudCoverPercent));
}

/**
 * Storm risk formula:
 * combines WMO weather-code severity, measured precipitation, and high wind speed.
 */
function calculateStormRisk(inputs: GridWeatherInputs): number {
  const weatherSeverity = weatherCodeStormSeverity(inputs.weatherCode);
  const precipitationSeverity = scaleToUnit(inputs.precipitationMm, 0, 25) * 100;
  const windSeverity = scaleToUnit(inputs.windSpeedKmh, 35, 90) * 100;

  return toScore(weatherSeverity * 0.5 + precipitationSeverity * 0.3 + windSeverity * 0.2);
}

/**
 * Heat stress formula:
 * no heat stress below 28 C; maximum stress at and above 45 C.
 */
function calculateHeatStress(temperatureCelsius: number): number {
  return toScore(scaleToUnit(temperatureCelsius, 28, 45) * 100);
}

function weatherCodeSolarPenalty(code: number): number {
  if (code === 0) return 0;
  if (code <= 3) return 0.08 + code * 0.08;
  if (code === 45 || code === 48) return 0.55;
  if (code >= 51 && code <= 67) return 0.65;
  if (code >= 71 && code <= 86) return 0.75;
  if (code >= 95) return 0.9;
  return 0.35;
}

function weatherCodeStormSeverity(code: number): number {
  if (code <= 3) return 0;
  if (code === 45 || code === 48) return 20;
  if (code >= 51 && code <= 57) return 35;
  if (code >= 61 && code <= 67) return 55;
  if (code >= 71 && code <= 77) return 50;
  if (code >= 80 && code <= 86) return 70;
  if (code === 95) return 85;
  if (code === 96 || code === 99) return 100;
  return 25;
}

function scaleToUnit(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function clampPercent(value: number): number {
  return clamp(value, 0, 100);
}

function toScore(value: number): number {
  return Math.round(clampPercent(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
