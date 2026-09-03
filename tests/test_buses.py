"""Tests de flota GPS simulada."""
from __future__ import annotations

import unittest

from buses.fleet import recommend, snapshot, tick


class TestBusFleet(unittest.TestCase):
    def test_snapshot_has_ten_buses_with_required_fields(self) -> None:
        buses = snapshot()
        self.assertEqual(len(buses), 10)
        required = {
            "id",
            "linea",
            "lat",
            "lng",
            "heading",
            "speed_kmh",
            "viene_de",
            "hacia",
        }
        for bus in buses:
            self.assertTrue(required.issubset(bus.keys()), msg=bus)
            self.assertRegex(bus["id"], r"^B-\d{2}$")
            self.assertGreater(bus["lat"], 10.85)
            self.assertLess(bus["lat"], 11.10)
            self.assertGreater(bus["lng"], -75.0)
            self.assertLess(bus["lng"], -74.70)

    def test_recommend_returns_eta(self) -> None:
        origen = {"nombre": "Centro", "lat": 10.9639, "lng": -74.7964}
        destino = {"nombre": "Soledad", "lat": 10.918, "lng": -74.767}
        rec = recommend(origen, destino)
        self.assertIsNotNone(rec)
        assert rec is not None
        self.assertIn("eta_min", rec)
        self.assertGreaterEqual(rec["eta_min"], 1)
        self.assertIn("id", rec)
        self.assertIn("linea", rec)
        self.assertIn("viene_de", rec)

    def test_tick_moves_buses(self) -> None:
        before = {(b["id"], b["lat"], b["lng"]) for b in snapshot()}
        for _ in range(5):
            tick()
        after = {(b["id"], b["lat"], b["lng"]) for b in snapshot()}
        self.assertNotEqual(before, after)


if __name__ == "__main__":
    unittest.main()
