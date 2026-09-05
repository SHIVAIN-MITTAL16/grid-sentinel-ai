import type { getNationalGridSnapshot } from "./grid-snapshot";

type NationalGridSnapshot = Awaited<ReturnType<typeof getNationalGridSnapshot>>;

export type FuelSource = {
  readonly id: "coal" | "gas" | "diesel" | "biomass";
  readonly label: string;
  readonly stockMwh: number;
  readonly maxDispatchMw: number;
  readonly marginalCostPerMwh: number;
  readonly efficiencyPercent: number;
  readonly carbonKgPerMwh: number;
};

export type FuelDispatch = FuelSource & {
  readonly recommendedDispatchMw: number;
  readonly stockAfterMwh: number;
  readonly stockUtilizationPercent: number;
};

export type FuelOptimizationResult = {
  readonly modeledAt: string;
  readonly requiredDispatchMw: number;
  readonly optimizedDispatchMw: number;
  readonly estimatedCost: number;
  readonly estimatedCarbonKg: number;
  readonly fuel: readonly FuelDispatch[];
};

// Explicitly modeled stock, expressed as energy-equivalent MWh so the dashboard never implies live tonnes.
export const MODELED_FUEL_STOCK: readonly FuelSource[] = [
  { id: "coal", label: "Coal", stockMwh: 18_400, maxDispatchMw: 4_200, marginalCostPerMwh: 3_900, efficiencyPercent: 38, carbonKgPerMwh: 820 },
  { id: "gas", label: "Natural Gas", stockMwh: 6_200, maxDispatchMw: 2_500, marginalCostPerMwh: 5_600, efficiencyPercent: 52, carbonKgPerMwh: 490 },
  { id: "biomass", label: "Biomass", stockMwh: 2_800, maxDispatchMw: 700, marginalCostPerMwh: 4_800, efficiencyPercent: 30, carbonKgPerMwh: 230 },
  { id: "diesel", label: "Diesel", stockMwh: 1_450, maxDispatchMw: 450, marginalCostPerMwh: 9_800, efficiencyPercent: 40, carbonKgPerMwh: 730 },
];

export function optimizeFuelDispatch(snapshot: NationalGridSnapshot): FuelOptimizationResult {
  const demandMw = snapshot.nationalDemandMw;
  const renewableMw = snapshot.nationalRenewableGenerationMw;
  const batteryMw = snapshot.states.reduce((sum, state) => sum + state.energy.batteryAvailableMwh / 4, 0);
  const dispatchableNeedMw = Math.max(0, demandMw - renewableMw - batteryMw);
  let remaining = dispatchableNeedMw;

  // Cost-first dispatch, while respecting modeled stock and unit limits.
  const fuel = [...MODELED_FUEL_STOCK]
    .sort((a, b) => a.marginalCostPerMwh - b.marginalCostPerMwh)
    .map((source) => {
      const dispatch = Math.min(source.maxDispatchMw, source.stockMwh, Math.max(0, remaining));
      remaining -= dispatch;
      return {
        ...source,
        recommendedDispatchMw: round(dispatch),
        stockAfterMwh: round(source.stockMwh - dispatch),
        stockUtilizationPercent: round((dispatch / Math.max(1, source.stockMwh)) * 100),
      };
    });

  const optimizedDispatchMw = fuel.reduce((sum, source) => sum + source.recommendedDispatchMw, 0);
  return {
    modeledAt: new Date().toISOString(),
    requiredDispatchMw: round(dispatchableNeedMw),
    optimizedDispatchMw,
    estimatedCost: round(fuel.reduce((sum, source) => sum + source.recommendedDispatchMw * source.marginalCostPerMwh, 0)),
    estimatedCarbonKg: round(fuel.reduce((sum, source) => sum + source.recommendedDispatchMw * source.carbonKgPerMwh, 0)),
    fuel,
  };
}

export function calculateEnergyMix(snapshot: NationalGridSnapshot, fuel: FuelOptimizationResult) {
  const solar = snapshot.states.reduce((sum, state) => sum + state.energy.solarGenerationMw, 0);
  const wind = snapshot.states.reduce((sum, state) => sum + state.energy.windGenerationMw, 0);
  const hydro = snapshot.states.reduce((sum, state) => sum + state.energy.hydroEstimateMw, 0);
  const battery = snapshot.states.reduce((sum, state) => sum + state.energy.batteryAvailableMwh / 4, 0);
  const thermal = fuel.optimizedDispatchMw;
  return [
    { name: "Solar", mw: round(solar), group: "Renewable" },
    { name: "Wind", mw: round(wind), group: "Renewable" },
    { name: "Hydro", mw: round(hydro), group: "Renewable" },
    { name: "Battery", mw: round(battery), group: "Storage" },
    { name: "Coal", mw: fuel.fuel.find((x) => x.id === "coal")?.recommendedDispatchMw ?? 0, group: "Fuel" },
    { name: "Gas", mw: fuel.fuel.find((x) => x.id === "gas")?.recommendedDispatchMw ?? 0, group: "Fuel" },
    { name: "Biomass", mw: fuel.fuel.find((x) => x.id === "biomass")?.recommendedDispatchMw ?? 0, group: "Other" },
    { name: "Diesel", mw: fuel.fuel.find((x) => x.id === "diesel")?.recommendedDispatchMw ?? 0, group: "Fuel" },
  ];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
