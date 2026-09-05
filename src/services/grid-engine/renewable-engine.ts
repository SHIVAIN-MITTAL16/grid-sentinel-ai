import { clamp, type GeneratorFleet } from "./types";
import type { WeatherEngineResult } from "./weather-engine";

export interface RenewableResult {
  readonly solarGenerationMW: number;
  readonly windGenerationMW: number;
  readonly hydroGenerationMW: number;
  readonly batterySocPct: number;
  readonly curtailmentMW: number;
}

/**
 * Solar MW = installed capacity × irradiance/1000 × inverter efficiency.
 * Wind MW = installed capacity × availability. Hydro is bounded by available water dispatch.
 * Battery SOC change = dispatched energy / installed battery energy.
 */
export function computeRenewables(
  fleet: GeneratorFleet,
  weather: WeatherEngineResult,
  hydroDispatchMW: number,
  batteryDispatchMW: number,
  intervalHours: number,
  gridAbsorptionMW: number,
): RenewableResult {
  const solarGenerationMW = fleet.solarCapacityMW * (weather.solarIrradianceWm2 / 1000) * 0.96;
  const windGenerationMW = fleet.windCapacityMW * (weather.windAvailabilityPct / 100);
  const hydroGenerationMW = clamp(hydroDispatchMW, 0, fleet.hydroCapacityMW);
  const rawRenewablesMW = solarGenerationMW + windGenerationMW + hydroGenerationMW;
  const curtailmentMW = Math.max(0, rawRenewablesMW - Math.max(0, gridAbsorptionMW));
  const batteryEnergyChangeMWh = batteryDispatchMW * intervalHours;
  const batterySocPct = clamp(
    fleet.batterySocPct - (batteryEnergyChangeMWh / Math.max(1, fleet.batteryEnergyMWh)) * 100,
    0,
    100,
  );
  return {
    solarGenerationMW: Math.round(solarGenerationMW),
    windGenerationMW: Math.round(windGenerationMW),
    hydroGenerationMW: Math.round(hydroGenerationMW),
    batterySocPct: Math.round(batterySocPct * 10) / 10,
    curtailmentMW: Math.round(curtailmentMW),
  };
}
