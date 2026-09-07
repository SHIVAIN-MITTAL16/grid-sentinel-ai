# Grid Sentinel AI — Judge Runbook

## Demo sequence

1. **Command Center** — establish the problem: predict, simulate, optimise, prevent.
2. **Digital Twin** — show the national state map, demand, renewables, reserve and risk.
3. **Evidence Room** — make Monte Carlo the hero:
   - energy mix
   - demand vs supply
   - modeled fuel stock availability
   - fuel optimisation and dispatch
   - seeded Monte Carlo risk
   - P05/P50/P95 uncertainty distributions
   - 95% estimator confidence interval
   - half-sample convergence stability
   - measured simulation throughput
   - backend module verification
4. **Crisis Lab** — stress the system and show how risk changes.
5. **Texas 2021** — connect the model to the historical replay.
6. **AI Control Room** — ask the operator-facing questions and explain the recommendations.

## Monte Carlo claims

Do **not** present Monte Carlo as a classifier and do not quote a fabricated "accuracy %". The correct quality measures shown in the Evidence Room are:

- seeded/reproducible scenario count
- loss-of-load probability
- expected unserved energy
- P05/P50/P95 distributions
- 95% confidence interval for the estimated probability
- half-sample stability gap as a simple convergence diagnostic
- measured wall-clock throughput in simulations/second

The uncertainty distributions are explicit model assumptions, not historical-data accuracy claims. Results should be described as **probabilistic model outputs for the stated scenario assumptions**.

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
GET /fuel-optimization
GET /polar-simulation?scenario=nominal
```

The backend uses dependency-free Python so the verification path does not depend on a separate ML framework or cloud service.

## Checklist before judging

- [ ] Evidence Room opens at `/evidence-room`
- [ ] Monte Carlo hero shows the seeded scenario count
- [ ] LOLP and its 95% confidence interval are visible
- [ ] EUE is visible
- [ ] Throughput and stability gap are visible
- [ ] Demand and renewable P05/P50/P95 distributions are populated
- [ ] Solar, wind, hydro, battery and fuel are visible
- [ ] Fuel stock shows before/after availability
- [ ] Fuel dispatch and modeled cost are visible
- [ ] Mathematical formulas are readable without opening source code
- [ ] Backend tests pass
- [ ] Backend `/health` reports all checks as PASS
- [ ] No stock number is described as live inventory
- [ ] No synthetic ML accuracy claim is presented
