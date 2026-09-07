# ⚡ Grid Sentinel AI

> **AI-assisted National Power Grid Digital Twin with Weather Intelligence, Monte Carlo Risk Simulation, Grid Optimization, Texas 2021 Replay and Gemini Decision Support**

---

## Overview

Grid Sentinel AI is a decision-support digital twin for studying power-grid resilience under changing demand, renewable availability and contingency conditions.

The platform combines:

- 🌤 External weather inputs
- ⚡ Modelled national-grid state and demand
- 🎲 Seeded Monte Carlo risk simulation
- 🤖 Gemini-powered AI assistant
- 📈 Renewable generation modelling
- 🧠 Grid dispatch and optimization logic
- 🇮🇳 India Digital Twin
- 🇺🇸 Texas Winter Storm Uri 2021 replay
- 🧊 Polar Research Station Digital Twin for SIH26061

The objective is to estimate risk, test scenarios and support operator decisions without claiming live utility telemetry or utility-grade SCADA control.

---

# Key Features

## 🇮🇳 India Digital Twin

- National grid visualization
- State-wise modelled monitoring
- Demand estimation
- Renewable generation tracking
- Reserve margin calculation
- Grid health and contingency analysis

The national network is a **reduced-order representative model**, not a complete physical model of India's transmission network.

---

## 🌦 Weather Intelligence

- Weather-driven renewable modelling
- Solar prediction
- Wind prediction
- Cloud-cover impact modelling
- External weather-data integration through Open-Meteo

---

## 🎲 Monte Carlo Simulation — Core Risk Engine

The system uses seeded probabilistic simulation to explore uncertainty in demand, solar, wind and battery availability.

It reports:

- Loss of Load Probability (LOLP)
- Expected Unserved Energy (EUE)
- Demand P05/P50/P95
- Renewable-generation P05/P50/P95
- 95% confidence interval for estimated LOLP
- Half-sample stability gap as a simple convergence diagnostic
- Measured simulation throughput

**Important:** Monte Carlo is not a classifier, so the project does not claim a fabricated "accuracy %". Estimator precision, convergence stability and measured performance are the appropriate validation signals for this simulation engine.

---

## ⚙ Grid Optimization

Decision logic evaluates:

- Renewable dispatch
- Grid balancing
- Reserve allocation
- Demand response
- Battery availability
- Reliability and congestion conditions

---

## 🤖 Gemini AI Control Room

Natural-language decision support for operators.

Example questions:

- What is the current blackout risk?
- Which state has the highest demand?
- What is the reserve margin?
- Compare the modelled grid with Texas 2021.
- What recommendations reduce the current risk?

Gemini is an advisory/explanation layer; the underlying grid calculations remain deterministic and probabilistic model outputs.

---

## 🇺🇸 Texas 2021 Replay

Historical replay based on included benchmark/replay data.

Includes:

- ERCOT demand
- Generation
- Weather observations
- Emergency conditions
- Replay statistics
- Peak demand
- Renewable-generation behaviour

---

## 🧊 Polar Research Station Digital Twin

A separate SIH26061 deployment surface for an isolated polar microgrid.

Scenarios include:

- Nominal weather
- Polar storm
- Low-light
- Wind derating

The model tracks critical/deferrable loads, solar, wind, battery SOC, backup generation, fuel and reserve targets across 5,000 seeded scenarios.

Inputs are explicitly **synthetic prototype assumptions**, not live polar-station telemetry.

---

# System Architecture

```text
Weather Inputs
      │
      ▼
Demand + Renewable Models
      │
      ▼
National Grid Snapshot
      │
 ┌────┼───────────────┐
 ▼    ▼               ▼
Monte Carlo   Grid Engine   Texas Replay
Risk Engine   + Contingency
 └────┼───────────────┘
      ▼
Dispatch / Decision Logic
      │
      ▼
Gemini AI Control Room
      │
      ▼
Operator Dashboard
```

---

# Technology Stack

## Frontend / application

- React
- TypeScript
- Vite
- TanStack Start / Router
- Tailwind CSS

## Decision engine

- Seeded Monte Carlo simulation
- DC power-flow model
- N-1 contingency analysis
- Reserve and reliability calculations
- Fuel/dispatch modelling

## AI

- Gemini API for natural-language decision support

## Verification

- Dependency-free Python backend checks
- GitHub CI

---

# Installation

```bash
git clone https://github.com/SHIVAIN-MITTAL16/grid-sentinel-ai.git
cd grid-sentinel-ai
npm ci
npm run dev
```

Production build:

```bash
npm run build
npm run start
```

---

# Environment Variables

For Gemini decision support, configure the key only on the server/deployment environment:

```text
GEMINI_API_KEY=YOUR_API_KEY
```

Never commit the key to Git.

---

# Render Deployment

The repository includes a `render.yaml` Blueprint for Render's Node web-service deployment.

Configuration uses:

```text
Build: npm ci && npm run build
Start: npm run start
Nitro preset: render-com
Host: 0.0.0.0
```

Render is the intended production deployment target for this project. The service should be connected to the `grid-sentinel-ai` repository and the production branch only after the integration branch has passed verification.

---

# Verification

Run the Python checks from the repository root:

```bash
python -m unittest discover -s backend -p "test_*.py" -v
```

Run the local verification server:

```bash
python backend/main.py
```

Available verification endpoints:

```text
GET /health
GET /fuel-optimization
GET /polar-simulation?scenario=nominal
```

---

# Future Enhancements

- Historical load/renewable backtesting
- Higher-fidelity network data
- Formal mathematical optimization solver
- Battery degradation modelling
- PMU/SCADA integrations when real data is available
- Larger validated weather/load datasets
- Additional polar-station scenarios

---

# Team

MonteCarlo Systems

- Shivain Mittal
- Charvi Manola
- Jiya Anand
- Parth Arora

---

# License

MIT License
