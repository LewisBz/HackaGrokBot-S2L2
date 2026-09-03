"""Tests de seleccion de bus recomendado."""
from __future__ import annotations

import unittest

from buses.fleet import choose_bus, fleet, recommend, snapshot


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
            "next_stop",
            "origen_linea",
            "destino_linea",
        }
        for bus in buses:
            self.assertTrue(required.issubset(bus.keys()), msg=bus)
            self.assertRegex(bus["id"], r"^B-\d{2}$")
            # Barranquilla approx
            self.assertGreater(bus["lat"], 10.85)
            self.assertLess(bus["lat"], 11.05)
            self.assertGreater(bus["lng"], -74.90)
            self.assertLess(bus["lng"], -74.75)

    def test_choose_nearest_aligned_bus(self) -> None:
        # Origen cerca de Uninorte; destino Centro (sur-este)
        origen = {"lat": 11.0198, "lng": -74.8508, "nombre": "Uninorte"}
        destino = {"lat": 10.9639, "lng": -74.7964, "nombre": "Centro"}
        # Bus A: cerca y rumbo hacia Centro (~SE ~135)
        # Bus B: cerca pero rumbo opuesto (~NW)
        # Bus C: lejos pero bien alineado
        buses = [
            {
                "id": "B-01",
                "linea": "Uninorte-Centro",
                "lat": 11.0180,
                "lng": -74.8480,
                "heading": 140.0,
                "speed_kmh": 30.0,
                "viene_de": "Uninorte",
            },
            {
                "id": "B-02",
                "linea": "Uninorte-Centro",
                "lat": 11.0185,
                "lng": -74.8490,
                "heading": 320.0,
                "speed_kmh": 30.0,
                "viene_de": "Centro",
            },
            {
                "id": "B-99",
                "linea": "Otro",
                "lat": 10.9700,
                "lng": -74.8000,
                "heading": 130.0,
                "speed_kmh": 30.0,
                "viene_de": "Prado",
            },
        ]
        chosen = choose_bus(buses, origen, destino)
        self.assertIsNotNone(chosen)
        assert chosen is not None
        self.assertEqual(chosen["id"], "B-01")
        self.assertIn("eta_min", chosen)
        self.assertIn("viene_de", chosen)
        self.assertIn("lat", chosen)
        self.assertIn("lng", chosen)

    def test_choose_returns_null_when_none_aligned(self) -> None:
        origen = {"lat": 11.02, "lng": -74.85}
        destino = {"lat": 10.96, "lng": -74.80}
        # Ambos buses van en sentido opuesto al destino
        buses = [
            {
                "id": "B-10",
                "linea": "X",
                "lat": 11.019,
                "lng": -74.849,
                "heading": 310.0,
                "speed_kmh": 28.0,
            },
            {
                "id": "B-11",
                "linea": "Y",
                "lat": 11.015,
                "lng": -74.845,
                "heading": 280.0,
                "speed_kmh": 28.0,
            },
        ]
        self.assertIsNone(choose_bus(buses, origen, destino))

    def test_fleet_recommend_shape(self) -> None:
        origen = {"lat": 10.9639, "lng": -74.7964, "nombre": "Centro"}
        destino = {"lat": 11.0198, "lng": -74.8508, "nombre": "Uninorte"}
        rec = recommend(origen, destino)
        if rec is not None:
            self.assertEqual(
                set(rec.keys()),
                {"id", "linea", "viene_de", "eta_min", "lat", "lng"},
            )
            self.assertRegex(rec["id"], r"^B-\d{2}$")
            self.assertIsInstance(rec["eta_min"], int)
            self.assertGreaterEqual(rec["eta_min"], 1)

    def test_tick_moves_buses(self) -> None:
        before = {b["id"]: (b["lat"], b["lng"]) for b in snapshot()}
        fleet.tick()
        after = {b["id"]: (b["lat"], b["lng"]) for b in snapshot()}
        moved = sum(1 for i in before if before[i] != after[i])
        self.assertGreaterEqual(moved, 1)


if __name__ == "__main__":
    unittest.main()
