# Grid Engine Simulation Pipeline

Night Shift calls `runSimulationPipeline` for its baseline, each mission event, and every operator intervention.

1. A mission profile supplies deterministic exogenous weather and asset conditions.
2. `weather-engine` derives irradiance, wind availability, and confidence.
3. `load-forecast` calculates demand and its uncertainty band.
4. `renewable-engine` calculates solar, wind, hydro, battery SOC, and curtailment.
5. `contingency-engine` evaluates base flow or N-1 redistribution.
6. `dispatch-optimizer` dispatches controllable resources using the selected operator intervention as a resource-priority constraint.
7. `reserve-engine` calculates primary, secondary, spinning, margin, and emergency reserve.
8. `reliability-index` computes SSI from frequency, reserve, congestion, EENS, renewable penetration, and risk.
9. `explainability` emits deterministic top reasons and a confidence score.

`simulation-pipeline.ts` returns one typed result used to construct Night Shift state. No UI component performs engineering calculations.
