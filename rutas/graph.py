"""Grafo de POIs de Barranquilla: nodos, aristas, Dijkstra y snap."""
from __future__ import annotations

import heapq
import math
from typing import Iterable

from rutas.geocode import PLACES

# Velocidad urbana media para pesos (minutos) = distancia / velocidad
_SPEED_KMH = 25.0
_SNAP_MAX_KM = 2.0

# Corredores reales entre zonas (bidireccionales)
_CORRIDORS: list[tuple[str, str]] = [
    ("Uninorte", "Riomar"),
    ("Uninorte", "Boston"),
    ("Uninorte", "Centro"),
    ("Riomar", "Boston"),
    ("Riomar", "Playa"),
    ("Boston", "Prado"),
    ("Boston", "Plaza de la Paz"),
    ("Prado", "Plaza de la Paz"),
    ("Prado", "Centro"),
    ("Plaza de la Paz", "Centro"),
    ("Plaza de la Paz", "Mercado"),
    ("Centro", "Mercado"),
    ("Centro", "Soledad"),
    ("Mercado", "Soledad"),
    ("Aeropuerto", "Soledad"),
    ("Aeropuerto", "Centro"),
    ("Uninorte", "Prado"),
]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def minutes_between(a: dict, b: dict) -> float:
    km = haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
    return (km / _SPEED_KMH) * 60.0


def _node_payload(node_id: str) -> dict:
    c = PLACES[node_id]
    return {"id": node_id, "nombre": node_id, "lat": c["lat"], "lng": c["lng"]}


def build_graph() -> tuple[dict[str, dict], dict[str, list[tuple[str, float]]]]:
    """Nodos {id -> payload} y adyacencia {id -> [(neighbor, weight_min), ...]}."""
    nodes = {name: _node_payload(name) for name in PLACES}
    adj: dict[str, list[tuple[str, float]]] = {name: [] for name in PLACES}
    seen: set[tuple[str, str]] = set()
    for a, b in _CORRIDORS:
        if a not in PLACES or b not in PLACES:
            continue
        key = tuple(sorted((a, b)))
        if key in seen:
            continue
        seen.add(key)
        w = minutes_between(PLACES[a], PLACES[b])
        adj[a].append((b, w))
        adj[b].append((a, w))
    return nodes, adj


NODES, ADJ = build_graph()


def all_edges() -> list[dict]:
    edges: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for u, nbrs in ADJ.items():
        for v, _w in nbrs:
            key = tuple(sorted((u, v)))
            if key in seen:
                continue
            seen.add(key)
            edges.append({"from": u, "to": v})
    return edges


def graph_full() -> dict:
    return {
        "nodos": list(NODES.values()),
        "aristas": all_edges(),
    }


def snap_to_node(
    lat: float,
    lng: float,
    max_km: float = _SNAP_MAX_KM,
) -> dict | None:
    """Nodo más cercano si está a <= max_km; si no, None."""
    best_id = None
    best_km = float("inf")
    for name, coords in PLACES.items():
        d = haversine_km(lat, lng, coords["lat"], coords["lng"])
        if d < best_km:
            best_km = d
            best_id = name
    if best_id is None or best_km > max_km:
        return None
    return dict(NODES[best_id])


def dijkstra(origen_id: str, destino_id: str) -> list[str] | None:
    """Camino más corto (lista de ids) o None si no hay ruta."""
    if origen_id not in ADJ or destino_id not in ADJ:
        return None
    if origen_id == destino_id:
        return [origen_id]

    dist: dict[str, float] = {origen_id: 0.0}
    prev: dict[str, str | None] = {origen_id: None}
    heap: list[tuple[float, str]] = [(0.0, origen_id)]

    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, float("inf")):
            continue
        if u == destino_id:
            break
        for v, w in ADJ[u]:
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))

    if destino_id not in prev and destino_id != origen_id:
        return None

    path: list[str] = []
    cur: str | None = destino_id
    while cur is not None:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()
    if path[0] != origen_id:
        return None
    return path


def path_as_grafo(path: Iterable[str]) -> dict:
    ids = list(path)
    nodos = [dict(NODES[i]) for i in ids if i in NODES]
    aristas = [{"from": ids[i], "to": ids[i + 1]} for i in range(len(ids) - 1)]
    return {"nodos": nodos, "aristas": aristas}


def resolve_endpoint(place: dict) -> dict | None:
    """
    Resuelve un geocode a un nodo del grafo.
    Si el nombre coincide con un nodo, úsalo; si no, snap por distancia.
    """
    nombre = (place.get("nombre") or "").strip()
    if nombre in NODES:
        return dict(NODES[nombre])
    lower = nombre.casefold()
    for key in NODES:
        if key.casefold() == lower:
            return dict(NODES[key])
    return snap_to_node(place["lat"], place["lng"])
