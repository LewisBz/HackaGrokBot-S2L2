"""Simulacion GPS de flota de buses en Barranquilla."""
from __future__ import annotations

import math
import threading
from typing import Any

from rutas.geocode import PLACES

_DEFAULT_SPEED = 28.0
_STEP_FRAC = 0.04


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lng2 - lng1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def _interp(a: tuple[float, float], b: tuple[float, float], t: float) -> tuple[float, float]:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def _polyline(a: str, b: str, mid: str | None = None) -> list[tuple[float, float]]:
    pts = [a]
    if mid:
        pts.append(mid)
    pts.append(b)
    return [(PLACES[n]["lat"], PLACES[n]["lng"]) for n in pts]


def _loop_poly(forward: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return forward + list(reversed(forward[:-1]))


_LINE_DEFS: list[tuple[str, str, str, str | None]] = [
    ("A-Uninorte", "Centro", "Uninorte", "Prado"),
    ("B-Aeropuerto", "Centro", "Aeropuerto", "Soledad"),
    ("C-Soledad", "Plaza de la Paz", "Soledad", "Mercado"),
    ("D-Riomar", "Centro", "Riomar", "Boston"),
    ("E-Playa", "Uninorte", "Playa", "Riomar"),
]


class Bus:
    __slots__ = (
        "id",
        "linea",
        "poly",
        "seg",
        "t",
        "viene_de",
        "hacia",
        "speed_kmh",
        "_ends",
    )

    def __init__(
        self,
        bus_id: str,
        linea: str,
        poly: list[tuple[float, float]],
        ends: tuple[str, str],
        phase: float = 0.0,
        speed: float = _DEFAULT_SPEED,
    ):
        self.id = bus_id
        self.linea = linea
        self.poly = poly
        self.seg = 0
        self.t = 0.0
        self.viene_de = ends[0]
        self.hacia = ends[1]
        self.speed_kmh = speed
        self._ends = ends
        total_segs = len(poly) - 1
        target = phase * total_segs
        self.seg = int(target) % total_segs
        self.t = target - int(target)
        self._refresh_labels()

    def _refresh_labels(self) -> None:
        n = len(self.poly) - 1
        half = max(1, n // 2)
        if self.seg < half:
            self.viene_de, self.hacia = self._ends[0], self._ends[1]
        else:
            self.viene_de, self.hacia = self._ends[1], self._ends[0]

    def position(self) -> tuple[float, float]:
        a = self.poly[self.seg]
        b = self.poly[min(self.seg + 1, len(self.poly) - 1)]
        return _interp(a, b, self.t)

    def heading(self) -> float:
        a = self.poly[self.seg]
        b = self.poly[min(self.seg + 1, len(self.poly) - 1)]
        if a == b and self.seg > 0:
            a = self.poly[self.seg - 1]
        return _bearing(a[0], a[1], b[0], b[1])

    def tick(self, step: float = _STEP_FRAC) -> None:
        self.t += step
        while self.t >= 1.0:
            self.t -= 1.0
            self.seg += 1
            if self.seg >= len(self.poly) - 1:
                self.seg = 0
            self._refresh_labels()

    def to_dict(self) -> dict[str, Any]:
        lat, lng = self.position()
        return {
            "id": self.id,
            "linea": self.linea,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "heading": round(self.heading(), 1),
            "speed_kmh": round(self.speed_kmh, 1),
            "viene_de": self.viene_de,
            "hacia": self.hacia,
        }


class Fleet:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.buses: list[Bus] = []
        self._build()

    def _build(self) -> None:
        buses: list[Bus] = []
        idx = 0
        for linea, a, b, mid in _LINE_DEFS:
            fwd = _polyline(a, b, mid)
            loop = _loop_poly(fwd)
            for j in range(2):
                idx += 1
                bus_id = f"B-{idx:02d}"
                phase = (j * 0.5 + (idx % 3) * 0.07) % 1.0
                speed = _DEFAULT_SPEED + (idx % 5) * 1.5
                buses.append(Bus(bus_id, linea, loop, (a, b), phase=phase, speed=speed))
        self.buses = buses

    def tick(self) -> None:
        with self._lock:
            for bus in self.buses:
                step = _STEP_FRAC * (bus.speed_kmh / _DEFAULT_SPEED)
                bus.tick(step)

    def snapshot(self) -> list[dict[str, Any]]:
        with self._lock:
            return [b.to_dict() for b in self.buses]

    def recommend(self, origen: dict, destino: dict) -> dict | None:
        o_lat, o_lng = origen["lat"], origen["lng"]
        d_lat, d_lng = destino["lat"], destino["lng"]
        dest_name = destino.get("nombre")
        desired = _bearing(o_lat, o_lng, d_lat, d_lng)
        best: dict | None = None
        best_score = float("inf")

        with self._lock:
            for bus in self.buses:
                lat, lng = bus.position()
                dist_km = _haversine_km(o_lat, o_lng, lat, lng)
                heading = bus.heading()
                ang = abs((heading - desired + 180) % 360 - 180)
                hacia_ok = bool(
                    dest_name and bus.hacia.casefold() == str(dest_name).casefold()
                )
                compatible = hacia_ok or ang < 90.0
                if not compatible:
                    continue
                score = dist_km + (0.0 if hacia_ok else ang / 90.0) * 2.0
                if score < best_score:
                    best_score = score
                    eta_min = max(1, round((dist_km / max(bus.speed_kmh, 1.0)) * 60))
                    snap = bus.to_dict()
                    snap["eta_min"] = eta_min
                    snap["dist_km"] = round(dist_km, 2)
                    best = snap

            if best is None and self.buses:
                nearest = min(
                    self.buses,
                    key=lambda b: _haversine_km(o_lat, o_lng, *b.position()),
                )
                lat, lng = nearest.position()
                dist_km = _haversine_km(o_lat, o_lng, lat, lng)
                eta_min = max(1, round((dist_km / max(nearest.speed_kmh, 1.0)) * 60))
                best = nearest.to_dict()
                best["eta_min"] = eta_min
                best["dist_km"] = round(dist_km, 2)

        return best


fleet = Fleet()


def tick() -> None:
    fleet.tick()


def snapshot() -> list[dict[str, Any]]:
    return fleet.snapshot()


def recommend(origen: dict, destino: dict) -> dict | None:
    return fleet.recommend(origen, destino)
