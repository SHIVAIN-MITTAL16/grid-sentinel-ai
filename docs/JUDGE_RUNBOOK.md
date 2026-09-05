# Grid Sentinel AI — Judge Runbook

## Demo sequence

1. **Command Center** — establish the problem: predict, simulate, optimise, prevent.
2. **Digital Twin** — show the national state map, demand, renewables, reserve and risk.
3. **Evidence Room** — use the new judge-facing sequence:
   - energy mix
   - demand vs supply
   - modeled fuel stock availability
   - fuel optimisation and dispatch
   - mathematical formulas
   - Monte Carlo P05/P50/P95 uncertainty
   - mathematical model vs ML counterfactual
   - backend module verification
4. **Crisis Lab** — stress the system and show how risk changes.
5. **Texas 2021** — connect the model to the historical replay.
6. **AI Control Room** — ask the operator-facing questions and explain the recommendations.

## What to say about ML

The ML panel is intentionally a **counterfactual research comparison**, not a fabricated production-accuracy claim. The benchmark is synthetic and deterministic. The mathematical model remains primary because it exposes the physical relationships between demand, renewables, storage, reserve and fuel constraints.

## Backend verification

Run from the repository root:

```bash
python -m unittest discover -s backend -p "test_*.py" -v
```

Expected: all backend tests pass.

To expose the JSON verification server:

```bash
python backend/main.py
```

Endpoints:

```text
GET /health
GET /model-benchmark
GET /fuel-optimization
```

The backend uses dependency-free Python so the verification path does not depend on a separate ML framework or cloud service.

## Checklist before judging

- [ ] Evidence Room opens at `/evidence-room`
- [ ] Demand and supply are visible
- [ ] Solar, wind, hydro, battery and fuel are visible
- [ ] Fuel stock shows before/after availability
- [ ] Fuel dispatch and modeled cost are visible
- [ ] Mathematical formulas are readable without opening source code
- [ ] P05/P50/P95 distributions are populated
- [ ] Mathematical model is labeled **PRIMARY**
- [ ] ML is labeled **COUNTERFACTUAL** and **synthetic**
- [ ] Backend tests pass
- [ ] Backend `/health` reports all checks as PASS
- [ ] No stock number is described as live inventory
- [ ] No synthetic accuracy number is described as field/production accuracy
