import { boundedHour, clamp, type WeatherInput } from "./types";

export interface WeatherEngineResult {
  readonly solarIrradianceWm2: number;
  readonly windAvailabilityPct: number;
  readonly forecastConfidencePct: number;
}

/**
 * Converts meteorological inputs into resource availability.
 * Irradiance = 1000 W/m² × solar-elevation × cloud-transmittance × humidity-transmittance.
 * Wind uses a simplified turbine power curve: cubic between cut-in and rated speed.
 */
export function evaluateWeather(input: WeatherInput): WeatherEngineResult {
  const hour = boundedHour(input.hour);
  const solarElevation = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const cloudTransmittance = 1 - (clamp(input.cloudCoverPct, 0, 100) / 100) * 0.82;
  const humidityTransmittance = 1 - (clamp(input.humidityPct, 0, 100) / 100) * 0.12;
  const solarIrradianceWm2 = Math.round(
    1000 * solarElevation * cloudTransmittance * humidityTransmittance,
  );

  const windMps = Math.max(0, input.windSpeedKmh / 3.6);
  const cutInMps = 3;
  const ratedMps = 12;
  const cutOutMps = 25;
  const windAvailabilityPct =
    windMps < cutInMps || windMps >= cutOutMps
      ? 0
      : windMps >= ratedMps
        ? 100
        : Math.round(((windMps ** 3 - cutInMps ** 3) / (ratedMps ** 3 - cutInMps ** 3)) * 100);

  // Confidence falls with fast-changing solar conditions (cloud/humidity) and high-wind protection risk.
  const uncertainty = clamp(
    input.cloudCoverPct * 0.35 + input.humidityPct * 0.12 + Math.max(0, windMps - 18) * 3,
    0,
    70,
  );
  return {
    solarIrradianceWm2,
    windAvailabilityPct,
    forecastConfidencePct: Math.round(100 - uncertainty),
  };
}
