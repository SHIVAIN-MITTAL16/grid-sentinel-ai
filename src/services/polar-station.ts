export type PolarScenario = "nominal" | "polar-storm" | "low-light" | "wind-derating";

export interface PolarStationState {
  scenario: PolarScenario;
  loadKw: number;
  criticalLoadKw: number;
  deferrableLoadKw: number;
  solarKw: number;
  windKw: number;
  batterySocPercent: number;
  batteryEnergyKwh: number;
  generatorKw: number;
  fuelLitres: number;
  reserveTargetPercent: number;
}

export interface PolarRiskResult {
  scenarios: number;
  shortageProbabilityPercent: number;
  expectedUnservedEnergyKwh: number;
  minimumSocPercent: number;
  fuelUsedLitres: number;
  renewableUtilizationPercent: number;
  recommendedAction: string;
}

export interface PolarBackendResult {
  state: PolarStationState;
  risk: PolarRiskResult;
  optimized: PolarRiskResult;
}

const BASE: Record<PolarScenario, Omit<PolarStationState, "scenario">> = {
  nominal: {
    loadKw: 72, criticalLoadKw: 48, deferrableLoadKw: 24, solarKw: 18, windKw: 42,
    batterySocPercent: 78, batteryEnergyKwh: 140, generatorKw: 50, fuelLitres: 620, reserveTargetPercent: 30,
  },
  "polar-storm": {
    loadKw: 84, criticalLoadKw: 52, deferrableLoadKw: 32, solarKw: 8, windKw: 27,
    batterySocPercent: 64, batteryEnergyKwh: 115, generatorKw: 50, fuelLitres: 620, reserveTargetPercent: 40,
  },
  "low-light": {
    loadKw: 80, criticalLoadKw: 51, deferrableLoadKw: 29, solarKw: 2, windKw: 40,
    batterySocPercent: 58, batteryEnergyKwh: 104, generatorKw: 50, fuelLitres: 620, reserveTargetPercent: 45,
  },
  "wind-derating": {
    loadKw: 76, criticalLoadKw: 49, deferrableLoadKw: 27, solarKw: 16, windKw: 17,
    batterySocPercent: 69, batteryEnergyKwh: 124, generatorKw: 50, fuelLitres: 620, reserveTargetPercent: 35,
  },
};

export function getPolarStationState(scenario: PolarScenario = "nominal"): PolarStationState {
  return { scenario, ...BASE[scenario] };
}

export async function fetchPolarSimulation(scenario: PolarScenario): Promise<PolarBackendResult> {
  const response = await fetch(
    `http://127.0.0.1:8010/polar-simulation?scenario=${encodeURIComponent(scenario)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
  return response.json() as Promise<PolarBackendResult>;
}

export function runPolarRiskSimulation(
  state: PolarStationState,
  scenarios = 5000,
  seed = 26061,
): PolarRiskResult {
  let shortage = 0;
  let eue = 0;
  let minSoc = 100;
  let fuelUsed = 0;
  let renewableAvailable = 0;
  let renewableUsed = 0;
  let rng = seed >>> 0;

  const random = () => {
    rng = (1664525 * rng + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  for (let i = 0; i < scenarios; i += 1) {
    const load = state.loadKw * (0.94 + random() * 0.14);
    const solar = state.solarKw * (0.78 + random() * 0.32);
    const wind = state.windKw * (0.72 + random() * 0.45);
    const renewable = solar + wind;
    const renewableForLoad = Math.min(load, renewable);
    const deficit = Math.max(0, load - renewable);
    const batteryAvailable = state.batteryEnergyKwh * (state.batterySocPercent / 100) * (0.82 + random() * 0.12);
    const reserveKwh = state.batteryEnergyKwh * (state.reserveTargetPercent / 100);
    const batteryDispatch = Math.min(deficit, Math.max(0, batteryAvailable - reserveKwh));
    const remaining = Math.max(0, deficit - batteryDispatch);
    const generatorAvailability = random() < 0.96 ? state.generatorKw : 0;
    const generatorDispatch = Math.min(remaining, generatorAvailability);
    const unserved = Math.max(0, remaining - generatorDispatch);
    const fuel = generatorDispatch * 0.29;
    const socDrop = (batteryDispatch / Math.max(1, state.batteryEnergyKwh)) * 100;

    renewableAvailable += renewable;
    renewableUsed += renewableForLoad;
    fuelUsed += fuel;
    eue += unserved;
    minSoc = Math.min(minSoc, state.batterySocPercent - socDrop);
    if (unserved > 0) shortage += 1;
  }

  const shortageProbabilityPercent = (shortage / scenarios) * 100;
  const renewableUtilizationPercent = renewableAvailable > 0 ? (renewableUsed / renewableAvailable) * 100 : 0;
  let recommendedAction = "Maintain renewable-first dispatch and preserve the battery reserve target.";
  if (shortageProbabilityPercent > 5 || minSoc < state.reserveTargetPercent) {
    recommendedAction = "Protect critical loads, defer flexible loads, preserve battery reserve, and start backup generation before reserve breach.";
  } else if (state.solarKw + state.windKw < state.loadKw * 0.65) {
    recommendedAction = "Pre-position backup generation and retain battery headroom because renewable coverage is below station demand.";
  }

  return {
    scenarios,
    shortageProbabilityPercent: round(shortageProbabilityPercent),
    expectedUnservedEnergyKwh: round(eue / scenarios),
    minimumSocPercent: round(Math.max(0, minSoc)),
    fuelUsedLitres: round(fuelUsed / scenarios),
    renewableUtilizationPercent: round(renewableUtilizationPercent),
    recommendedAction,
  };
}

export function optimizePolarDispatch(state: PolarStationState): PolarRiskResult {
  const baseline = runPolarRiskSimulation(state);
  const optimizedState: PolarStationState = {
    ...state,
    loadKw: Math.max(state.criticalLoadKw, state.loadKw - state.deferrableLoadKw * 0.55),
    batterySocPercent: Math.max(state.batterySocPercent, state.reserveTargetPercent + 12),
  };
  const optimized = runPolarRiskSimulation(optimizedState);

  return {
    ...optimized,
    recommendedAction:
      optimized.shortageProbabilityPercent < baseline.shortageProbabilityPercent
        ? `Dispatch optimized: defer ${Math.round(state.deferrableLoadKw * 0.55)} kW of flexible load and protect the battery reserve. ${optimized.recommendedAction}`
        : optimized.recommendedAction,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
