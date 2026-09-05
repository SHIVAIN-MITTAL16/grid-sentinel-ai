import { clamp, type DispatchState } from "./types";

export interface ReserveResult {
  readonly primaryReserveMW: number;
  readonly secondaryReserveMW: number;
  readonly spinningReserveMW: number;
  readonly reserveMarginPct: number;
  readonly emergencyMarginMW: number;
}

/**
 * Primary/secondary reserve are fixed response fractions of online controllable generation.
 * Spinning reserve is unused online controllable capacity. Emergency margin is capacity less demand and reserve need.
 */
export function calculateReserves(state: DispatchState): ReserveResult {
  const controllableOnlineMW = state.thermalMW + state.hydroMW + Math.max(0, state.batteryMW);
  const unusedCapacityMW = Math.max(0, state.availableCapacityMW - state.demandMW);
  const primaryReserveMW = Math.round(Math.min(unusedCapacityMW, controllableOnlineMW * 0.035));
  const secondaryReserveMW = Math.round(
    Math.min(Math.max(0, unusedCapacityMW - primaryReserveMW), controllableOnlineMW * 0.07),
  );
  const spinningReserveMW = Math.round(Math.min(unusedCapacityMW, controllableOnlineMW * 0.12));
  const reserveMarginPct =
    ((state.availableCapacityMW - state.demandMW) / Math.max(1, state.demandMW)) * 100;
  const emergencyMarginMW = Math.round(
    state.availableCapacityMW - state.demandMW - primaryReserveMW - secondaryReserveMW,
  );
  return {
    primaryReserveMW,
    secondaryReserveMW,
    spinningReserveMW,
    reserveMarginPct: Math.round(clamp(reserveMarginPct, -100, 100) * 100) / 100,
    emergencyMarginMW,
  };
}
