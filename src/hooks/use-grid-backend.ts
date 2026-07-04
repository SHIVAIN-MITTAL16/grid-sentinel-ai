import { useQuery } from "@tanstack/react-query";

import { getNationalGridSnapshot } from "@/services/grid-snapshot";
import { optimizeGridDispatch } from "@/services/grid-optimizer";
import { runMonteCarloSimulation } from "@/services/monte-carlo";

type NationalGridSnapshot = Awaited<ReturnType<typeof getNationalGridSnapshot>>;
type MonteCarloResult = ReturnType<typeof runMonteCarloSimulation>;
type GridOptimizerResult = ReturnType<typeof optimizeGridDispatch>;

const DEFAULT_STALE_TIME_MS = 60_000;

export const gridBackendQueryKeys = {
  snapshot: ["grid-backend", "national-snapshot"] as const,
  monteCarlo: (seed?: number, simulations?: number) =>
    [
      "grid-backend",
      "monte-carlo",
      seed ?? "default-seed",
      simulations ?? "default-count",
    ] as const,
  optimizer: (seed?: number, simulations?: number) =>
    ["grid-backend", "optimizer", seed ?? "default-seed", simulations ?? "default-count"] as const,
};

interface GridBackendHookOptions {
  readonly enabled?: boolean;
  readonly staleTimeMs?: number;
}

interface MonteCarloHookOptions extends GridBackendHookOptions {
  readonly seed?: number;
  readonly simulations?: number;
}

export function useNationalGridSnapshot(options: GridBackendHookOptions = {}) {
  return useQuery<NationalGridSnapshot>({
    queryKey: gridBackendQueryKeys.snapshot,
    queryFn: getNationalGridSnapshot,
    enabled: options.enabled ?? true,
    staleTime: options.staleTimeMs ?? DEFAULT_STALE_TIME_MS,
  });
}

export function useMonteCarloResult(options: MonteCarloHookOptions = {}) {
  const snapshot = useNationalGridSnapshot(options);

  return useQuery<MonteCarloResult>({
    queryKey: gridBackendQueryKeys.monteCarlo(options.seed, options.simulations),
    queryFn: () => {
      if (!snapshot.data) throw new Error("National grid snapshot is required for Monte Carlo.");
      return runMonteCarloSimulation(snapshot.data, {
        seed: options.seed,
        simulations: options.simulations,
      });
    },
    enabled: (options.enabled ?? true) && Boolean(snapshot.data),
    staleTime: options.staleTimeMs ?? DEFAULT_STALE_TIME_MS,
  });
}

export function useGridOptimizerResult(options: MonteCarloHookOptions = {}) {
  const snapshot = useNationalGridSnapshot(options);
  const monteCarlo = useMonteCarloResult(options);

  return useQuery<GridOptimizerResult>({
    queryKey: gridBackendQueryKeys.optimizer(options.seed, options.simulations),
    queryFn: () => {
      if (!snapshot.data) throw new Error("National grid snapshot is required for optimization.");
      return optimizeGridDispatch({
        snapshot: snapshot.data,
        monteCarlo: monteCarlo.data,
      });
    },
    enabled: (options.enabled ?? true) && Boolean(snapshot.data) && Boolean(monteCarlo.data),
    staleTime: options.staleTimeMs ?? DEFAULT_STALE_TIME_MS,
  });
}
