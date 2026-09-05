from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from grid_backend import health_payload, model_benchmark, optimize_fuel_dispatch


POLAR_STATES = {
    "nominal": {"loadKw": 72, "criticalLoadKw": 48, "deferrableLoadKw": 24, "solarKw": 18, "windKw": 42, "batterySocPercent": 78, "batteryEnergyKwh": 140, "generatorKw": 50, "fuelLitres": 620, "reserveTargetPercent": 30},
    "polar-storm": {"loadKw": 84, "criticalLoadKw": 52, "deferrableLoadKw": 32, "solarKw": 8, "windKw": 27, "batterySocPercent": 64, "batteryEnergyKwh": 115, "generatorKw": 50, "fuelLitres": 620, "reserveTargetPercent": 40},
    "low-light": {"loadKw": 80, "criticalLoadKw": 51, "deferrableLoadKw": 29, "solarKw": 2, "windKw": 40, "batterySocPercent": 58, "batteryEnergyKwh": 104, "generatorKw": 50, "fuelLitres": 620, "reserveTargetPercent": 45},
    "wind-derating": {"loadKw": 76, "criticalLoadKw": 49, "deferrableLoadKw": 27, "solarKw": 16, "windKw": 17, "batterySocPercent": 69, "batteryEnergyKwh": 124, "generatorKw": 50, "fuelLitres": 620, "reserveTargetPercent": 35},
}


def _round(value: float) -> float:
    return round(value * 10) / 10


def polar_risk(state: dict, scenarios: int = 5000, seed: int = 26061) -> dict:
    shortage = eue = min_soc = fuel_used = renewable_available = renewable_used = 0.0
    min_soc = 100.0
    rng = seed & 0xFFFFFFFF

    def random() -> float:
        nonlocal rng
        rng = (1664525 * rng + 1013904223) & 0xFFFFFFFF
        return rng / 4294967296

    for _ in range(scenarios):
        load = state["loadKw"] * (0.94 + random() * 0.14)
        solar = state["solarKw"] * (0.78 + random() * 0.32)
        wind = state["windKw"] * (0.72 + random() * 0.45)
        renewable = solar + wind
        renewable_for_load = min(load, renewable)
        deficit = max(0.0, load - renewable)
        battery_available = state["batteryEnergyKwh"] * (state["batterySocPercent"] / 100) * (0.82 + random() * 0.12)
        reserve_kwh = state["batteryEnergyKwh"] * (state["reserveTargetPercent"] / 100)
        battery_dispatch = min(deficit, max(0.0, battery_available - reserve_kwh))
        remaining = max(0.0, deficit - battery_dispatch)
        generator_availability = state["generatorKw"] if random() < 0.96 else 0
        generator_dispatch = min(remaining, generator_availability)
        unserved = max(0.0, remaining - generator_dispatch)
        fuel = generator_dispatch * 0.29
        soc_drop = (battery_dispatch / max(1.0, state["batteryEnergyKwh"])) * 100

        renewable_available += renewable
        renewable_used += renewable_for_load
        fuel_used += fuel
        eue += unserved
        min_soc = min(min_soc, state["batterySocPercent"] - soc_drop)
        if unserved > 0:
            shortage += 1

    shortage_probability = shortage / scenarios * 100
    renewable_utilization = renewable_used / renewable_available * 100 if renewable_available else 0
    recommended = "Maintain renewable-first dispatch and preserve the battery reserve target."
    if shortage_probability > 5 or min_soc < state["reserveTargetPercent"]:
        recommended = "Protect critical loads, defer flexible loads, preserve battery reserve, and start backup generation before reserve breach."
    elif state["solarKw"] + state["windKw"] < state["loadKw"] * 0.65:
        recommended = "Pre-position backup generation and retain battery headroom because renewable coverage is below station demand."

    return {
        "scenarios": scenarios,
        "shortageProbabilityPercent": _round(shortage_probability),
        "expectedUnservedEnergyKwh": _round(eue / scenarios),
        "minimumSocPercent": _round(max(0.0, min_soc)),
        "fuelUsedLitres": _round(fuel_used / scenarios),
        "renewableUtilizationPercent": _round(renewable_utilization),
        "recommendedAction": recommended,
    }


def polar_simulation(scenario: str) -> dict:
    if scenario not in POLAR_STATES:
        scenario = "nominal"
    state = {"scenario": scenario, **POLAR_STATES[scenario]}
    baseline = polar_risk(state)
    optimized_state = {
        **state,
        "loadKw": max(state["criticalLoadKw"], state["loadKw"] - state["deferrableLoadKw"] * 0.55),
        "batterySocPercent": max(state["batterySocPercent"], state["reserveTargetPercent"] + 12),
    }
    optimized = polar_risk(optimized_state)
    if optimized["shortageProbabilityPercent"] < baseline["shortageProbabilityPercent"]:
        optimized["recommendedAction"] = (
            f"Dispatch optimized: defer {round(state['deferrableLoadKw'] * 0.55)} kW of flexible load and protect the battery reserve. "
            + optimized["recommendedAction"]
        )
    return {"state": state, "risk": baseline, "optimized": optimized}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict) -> None:
        body = json.dumps(payload, indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        if path == "/health":
            self.send_json(health_payload())
        elif path == "/model-benchmark":
            self.send_json(model_benchmark())
        elif path == "/fuel-optimization":
            self.send_json(optimize_fuel_dispatch(7000, 2500, 600))
        elif path == "/polar-simulation":
            scenario = query.get("scenario", ["nominal"])[0]
            self.send_json(polar_simulation(scenario))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[backend] {fmt % args}")


if __name__ == "__main__":
    print("Grid Sentinel backend verification server")
    print("GET /health | /model-benchmark | /fuel-optimization | /polar-simulation?scenario=nominal")
    HTTPServer(("0.0.0.0", 8010), Handler).serve_forever()
