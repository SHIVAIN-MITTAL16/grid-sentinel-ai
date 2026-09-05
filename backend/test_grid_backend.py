import unittest

from backend.grid_backend import (
    model_benchmark,
    optimize_fuel_dispatch,
    reserve_margin,
    run_module_checks,
    solar_generation,
)


class GridBackendTests(unittest.TestCase):
    def test_solar_generation_is_bounded(self):
        self.assertEqual(solar_generation(2500, 0), 0)
        self.assertEqual(solar_generation(2500, 100), 2500)

    def test_reserve_margin(self):
        self.assertAlmostEqual(reserve_margin(110, 100), 10.0)

    def test_fuel_stock_is_never_negative(self):
        result = optimize_fuel_dispatch(7000, 1500, 500)
        for source in result["dispatch"]:
            self.assertGreaterEqual(source["stock_after_mwh"], 0)

    def test_fuel_dispatch_is_cost_ordered(self):
        result = optimize_fuel_dispatch(7000, 1000, 0)
        used = [x for x in result["dispatch"] if x["recommended_dispatch_mw"] > 0]
        costs = [x["marginal_cost_per_mwh"] for x in used]
        self.assertEqual(costs, sorted(costs))

    def test_math_model_beats_ml_counterfactual(self):
        benchmark = model_benchmark()
        self.assertGreater(
            benchmark["mathematical_accuracy_percent"],
            benchmark["ml_accuracy_percent"],
        )
        self.assertGreater(
            benchmark["mathematical_lead_time_hours"],
            benchmark["ml_lead_time_hours"],
        )

    def test_all_module_checks_pass(self):
        checks = run_module_checks()
        self.assertTrue(checks)
        self.assertTrue(all(item["status"] == "PASS" for item in checks))


if __name__ == "__main__":
    unittest.main(verbosity=2)
