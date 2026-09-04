"""Tests del grafo Barranquilla (Dijkstra Centro ↔ Soledad)."""
from __future__ import annotations

import unittest

from rutas.graph import (
    ADJ,
    NODES,
    dijkstra,
    haversine_km,
    path_as_grafo,
    snap_to_node,
)


class TestGraph(unittest.TestCase):
    def test_nodes_include_poi(self):
        for name in ("Centro", "Soledad", "Uninorte", "Aeropuerto", "Playa"):
            self.assertIn(name, NODES)

    def test_centro_soledad_connected(self):
        path = dijkstra("Centro", "Soledad")
        self.assertIsNotNone(path)
        self.assertEqual(path[0], "Centro")
        self.assertEqual(path[-1], "Soledad")
        # Corredor directo existe
        nbrs = {v for v, _ in ADJ["Centro"]}
        self.assertIn("Soledad", nbrs)
        self.assertEqual(path, ["Centro", "Soledad"])

    def test_soledad_centro_symmetric(self):
        path = dijkstra("Soledad", "Centro")
        self.assertEqual(path, ["Soledad", "Centro"])

    def test_uninorte_aeropuerto_multihop(self):
        path = dijkstra("Uninorte", "Aeropuerto")
        self.assertIsNotNone(path)
        self.assertGreaterEqual(len(path), 3)
        self.assertEqual(path[0], "Uninorte")
        self.assertEqual(path[-1], "Aeropuerto")

    def test_path_as_grafo(self):
        g = path_as_grafo(["Centro", "Soledad"])
        self.assertEqual(len(g["nodos"]), 2)
        self.assertEqual(g["aristas"], [{"from": "Centro", "to": "Soledad"}])

    def test_snap_near_centro(self):
        # ~100 m del Centro
        node = snap_to_node(10.9645, -74.7960)
        self.assertIsNotNone(node)
        self.assertEqual(node["id"], "Centro")

    def test_snap_rejects_far(self):
        # Bogotá approx
        self.assertIsNone(snap_to_node(4.711, -74.072))

    def test_haversine_centro_soledad(self):
        c, s = NODES["Centro"], NODES["Soledad"]
        km = haversine_km(c["lat"], c["lng"], s["lat"], s["lng"])
        self.assertGreater(km, 4)
        self.assertLess(km, 12)


if __name__ == "__main__":
    unittest.main()
