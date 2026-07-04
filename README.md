# ⚡ Grid Sentinel AI

> **AI-Powered National Power Grid Digital Twin with Weather Intelligence, Monte Carlo Risk Simulation, Grid Optimization, Texas 2021 Replay and Gemini AI Decision Support**

---

## Overview

Grid Sentinel AI is an intelligent power-grid digital twin that helps operators monitor, analyze and optimize a national electricity grid in real time.

The platform combines:

- 🌤 Live weather forecasting
- ⚡ National grid monitoring
- 🎲 Monte Carlo risk simulation
- 🤖 Gemini-powered AI assistant
- 📈 Renewable generation forecasting
- 🧠 Grid optimization
- 🇮🇳 India Digital Twin
- 🇺🇸 Texas Winter Storm Uri 2021 replay

The objective is to improve grid resilience, reduce blackout risk and assist operators in making informed decisions during both normal and emergency operating conditions.

---

# Key Features

## 🇮🇳 India Digital Twin

- National grid visualization
- State-wise monitoring
- Live demand estimation
- Renewable generation tracking
- Reserve margin calculation
- Grid health monitoring

---

## 🌦 Weather Intelligence

- Weather-driven renewable forecasting
- Solar prediction
- Wind prediction
- Weather impact analysis
- Cloud cover modelling

---

## 🎲 Monte Carlo Simulation

Thousands of probabilistic scenarios are simulated to estimate:

- Blackout probability
- Loss of Load Probability (LOLP)
- Expected Unserved Energy (EUE)
- Renewable uncertainty
- Demand uncertainty

---

## ⚙ Grid Optimization

Optimization engine recommends:

- Renewable dispatch
- Grid balancing
- Reserve allocation
- Demand management
- Reliability improvements

---

## 🤖 Gemini AI Control Room

Natural language interface for grid operators.

Example questions:

- What is today's blackout probability?
- Which state has the highest demand?
- What is the reserve margin?
- Compare today's grid with Texas 2021.
- What was the replay peak demand?
- Which hour had the highest blackout probability?
- What recommendations do you have?

---

## 🇺🇸 Texas 2021 Replay

Historical replay based on benchmark datasets.

Includes:

- ERCOT demand
- Generation
- Weather observations
- Emergency alerts
- Replay statistics
- Peak demand
- Peak renewable generation
- Worst blackout period

Operators can compare current grid conditions against Winter Storm Uri.

---

# System Architecture

```

                NOAA Weather
                      │
                      ▼
             Weather Forecast Engine
                      │
                      ▼
             Renewable Forecast Model
                      │
                      ▼
      Live National Grid Digital Twin
                      │
      ┌───────────────┼──────────────┐
      ▼               ▼              ▼

Monte Carlo Grid Optimizer Texas Replay
Simulation

      └───────────────┼──────────────┘
                      ▼
             Gemini AI Control Room
                      ▼
              Operator Dashboard

```

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

## Backend Logic

- TypeScript
- Gemini API
- Monte Carlo Simulation

## Data

- ERCOT benchmark datasets
- NOAA weather observations
- Texas replay datasets

---

# Project Structure

```

src/

├── components/
├── data/
│   └── texas-uri/
├── hooks/
├── routes/
├── services/
│   ├── gemini-service.ts
│   ├── gemini-control-room.ts
│   ├── monte-carlo.ts
│   ├── weather-service.ts
│   ├── texas-replay.ts
│   ├── texas-replay-data.ts
│   └── grid-optimizer.ts

```

---

# AI Pipeline

Weather
↓

Renewable Forecast

↓

National Grid Snapshot

↓

Monte Carlo Simulation

↓

Grid Optimization

↓

Texas Replay Comparison

↓

Gemini AI Response

---

# Example Operator Queries

```

What is today's reserve margin?

Compare today's grid with Texas 2021.

What hour had the highest blackout probability?

Which state currently has the highest demand?

Show renewable generation.

Recommend actions to reduce blackout risk.

```

---

# Installation

```bash
git clone https://github.com/SHIVAIN-MITTAL16/montecarlo_systems_hackathon_project.git

cd futuregrid-ai-main

npm install

npm run dev
```

---

# Environment Variables

Create:

```
.env.local
```

```
GEMINI_API_KEY=YOUR_API_KEY
```

---

# Future Enhancements

- Battery dispatch optimization
- PMU integration
- SCADA connectivity
- Multi-country digital twins
- Reinforcement Learning dispatch
- Carbon emission optimization

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

---


⭐ If you like this project, consider giving it a star.

⭐ If you like this project, consider giving it a star.

## 📸 Screenshots

### Dashboard

![Dashboard](screenshots/dashboard.png)

---

### AI Control Room

![Control Room](screenshots/ai-control-room.png)

---

### India Digital Twin

![India Map](screenshots/India-map.png)

---

### Texas 2021 Replay

![Texas Replay](screenshots/texas-replay.png)

---

### Monte Carlo Simulation

![Simulation](screenshots/monte-carlo.png)

---

### Crisis Lab Simulation

![Simulation](screenshots/crisis-lab.png)
