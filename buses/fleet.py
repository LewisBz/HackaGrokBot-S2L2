"""Simulacion GPS en vivo de flota de buses en Barranquilla."""
from __future__ import annotations

import math
import threading
import time
from typing import Any

# Velocidad nominal simulada (km/h)
_DEFAULT_SPEED = 28.0
# Avance por tick (~1s): fraccion de segmento
_STEP_FRAC = 0.04

# Lugares locales (no importar rutas: arquitectura modular)
_PLACES: dict[str, tuple[float, float]] = {
    "Centro": (10.9639, -74.7964),
    "Soledad": (10.9180, -74.7670),
    "Plaza de la Paz": (10.9878, -74.7889),
    "Aeropuerto": (10.8896, -74.7808),
    "Mercado": (10.9790, -74.7770),
    "Boston": (11.0040, -74.8070),
    "Riomar": (11.0140, -74.8280),
    "Prado": (10.9980, -74.8070),
    "Uninorte": (11.0198, -74.8508),
}

# Corredores: (linea, origen_linea, destino_linea, waypoints intermedios)
_CORRIDORS: list[tuple[str, str, str, list[str]]] = [
    ("Uninorte-Centro", "Uninorte", "Centro", ["Prado"]),
    ("Aeropuerto-Centro", "Aeropuerto", "Centro", ["Soledad"]),
    ("Soledad-Mercado", "Soledad", "Mercado", []),
    ("Riomar-Prado", "Riomar", "Prado", ["Boston"]),
    ("Boston-Plaza de la Paz", "Boston", "Plaza de la Paz", ["Prado"]),
]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def _bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Heading en grados [0, 360)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lng2 - lng1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def _angle_diff(a: float, b: float) -> float:
    """Diferencia angular absoluta minima [0, 180]."""
    return abs((a - b + 180.0) % 360.0 - 180.0)


def _interp(a: tuple[float, float], b: tuple[float, float], t: float) -> tuple[float, float]:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def _build_polyline(origen: str, destino: str, mids: list[str]) -> list[tuple[float, float]]:
    names = [origen, *mids, destino]
    return [_PLACES[n] for n in names]


def _loop_poly(forward: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Ida + vuelta para loop continuo (sin duplicar el extremo)."""
    return forward + list(reversed(forward[:-1]))


def _stop_names(origen: str, destino: str, mids: list[str]) -> list[str]:
    """Nombres de paradas en el loop ida-vuelta."""
    fwd = [origen, *mids, destino]
    return fwd + list(reversed(fwd[:-1]))


class Bus:
    __slots__ = (
        "id",
        "linea",
        "origen_linea",
        "destino_linea",
        "poly",
        "stops",
        "seg",
        "t",
        "speed_kmh",
    )

    def __init__(
        self,
        bus_id: str,
        linea: str,
        origen_linea: str,
        destino_linea: str,
        poly: list[tuple[float, float]],
        stops: list[str],
        phase: float = 0.0,
        speed: float = _DEFAULT_SPEED,
    ) -> None:
        self.id = bus_id
        self.linea = linea
        self.origen_linea = origen_linea
        self.destino_linea = destino_linea
        self.poly = poly
        self.stops = stops
        self.speed_kmh = speed
        total_segs = max(1, len(poly) - 1)
        target = (phase % 1.0) * total_segs
        self.seg = int(target) % total_segs
        self.t = target - int(target)

    def position(self) -> tuple[float, float]:
        a = self.poly[self.seg]
        nxt = self.seg + 1
        b = self.poly[nxt] if nxt < len(self.poly) else self.poly[0]
        return _interp(a, b, self.t)

    def heading(self) -> float:
        a = self.poly[self.seg]
        nxt = self.seg + 1
        b = self.poly[nxt] if nxt < len(self.poly) else self.poly[0]
        if a == b and self.seg > 0:
            a = self.poly[self.seg - 1]
        return _bearing(a[0], a[1], b[0], b[1])

    def next_stop(self) -> str:
        # Parada hacia la que avanza el segmento actual
        idx = (self.seg + 1) % len(self.stops)
        return self.stops[idx]

    def viene_de(self) -> str:
        """Extremo de linea desde el que viene (segun mitad del loop)."""
        n = len(self.poly) - 1
        half = max(1, n // 2)
        if self.seg < half:
            return self.origen_linea
        return self.destino_linea

    def tick(self, step: float = _STEP_FRAC) -> None:
        self.t += step
        while self.t >= 1.0:
            self.t -= 1.0
            self.seg += 1
            if self.seg >= len(self.poly) - 1:
                self.seg = 0

    def to_dict(self) -> dict[str, Any]:
        lat, lng = self.position()
        return {
            "id": self.id,
            "linea": self.linea,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "heading": round(self.heading(), 1),
            "speed_kmh": round(self.speed_kmh, 1),
            "next_stop": self.next_stop(),
            "origen_linea": self.origen_linea,
            "destino_linea": self.destino_linea,
        }


class Fleet:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.buses: list[Bus] = []
        self._started = False
        self._thread: threading.Thread | None = None
        self._build()

    def _build(self) -> None:
        buses: list[Bus] = []
        idx = 0
        for linea, origen, destino, mids in _CORRIDORS:
            fwd = _build_polyline(origen, destino, mids)
            loop = _loop_poly(fwd)
            stops = _stop_names(origen, destino, mids)
            for j in range(2):
                idx += 1
                bus_id = f"B-{idx:02d}"
                phase = (j * 0.5 + (idx % 3) * 0.07) % 1.0
                speed = _DEFAULT_SPEED + (idx % 5) * 1.5
                buses.append(
                    Bus(
                        bus_id,
                        linea,
                        origen,
                        destino,
                        loop,
                        stops,
                        phase=phase,
                        speed=speed,
                    )
                )
        self.buses = buses

    def tick(self) -> None:
        with self._lock:
            for bus in self.buses:
                step = _STEP_FRAC * (bus.speed_kmh / _DEFAULT_SPEED)
                bus.tick(step)

    def snapshot(self) -> list[dict[str, Any]]:
        with self._lock:
            return [b.to_dict() for b in self.buses]

    def start(self, interval_s: float = 1.0) -> None:
        """Arranca el ticker en background (idempotente)."""
        with self._lock:
            if self._started:
                return
            self._started = True

        def _loop() -> None:
            while True:
                try:
                    self.tick()
                except Exception:
                    pass
                time.sleep(interval_s)

        self._thread = threading.Thread(target=_loop, name="bus-fleet-ticker", daemon=True)
        self._thread.start()

    def recommend(self, origen: dict, destino: dict) -> dict | None:
        """Bus mas cercano al origen cuyo rumbo se acerca al destino.

        Retorna {id, linea, viene_de, eta_min, lat, lng} o None.
        """
        o_lat, o_lng = float(origen["lat"]), float(origen["lng"])
        d_lat, d_lng = float(destino["lat"]), float(destino["lng"])
        desired = _bearing(o_lat, o_lng, d_lat, d_lng)

        best: dict | None = None
        best_score = float("inf")

        with self._lock:
            for bus in self.buses:
                lat, lng = bus.position()
                dist_km = _haversine_km(o_lat, o_lng, lat, lng)
                heading = bus.heading()
                ang = _angle_diff(heading, desired)
                # Solo candidatos cuyo rumbo se acerca al destino
                if ang >= 90.0:
                    continue
                # Preferir cercania + alineacion
                score = dist_km + (ang / 90.0) * 2.0
                if score < best_score:
                    best_score = score
                    eta_min = max(1, round((dist_km / max(bus.speed_kmh, 1.0)) * 60))
                    best = {
                        "id": bus.id,
                        "linea": bus.linea,
                        "viene_de": bus.viene_de(),
                        "eta_min": eta_min,
                        "lat": round(lat, 6),
                        "lng": round(lng, 6),
                    }

        return best


fleet = Fleet()


def start_simulator(interval_s: float = 1.0) -> None:
    fleet.start(interval_s)


def tick() -> None:
    fleet.tick()


def snapshot() -> list[dict[str, Any]]:
    return fleet.snapshot()


def recommend(origen: dict, destino: dict) -> dict | None:
    return fleet.recommend(origen, destino)


def choose_bus(buses: list[dict], origen: dict, destino: dict) -> dict | None:
    """Seleccion pura para tests: misma logica que Fleet.recommend sobre dicts.

    Cada bus: {id, linea, lat, lng, heading, speed_kmh, ...} y opcional viene_de.
    """
    o_lat, o_lng = float(origen["lat"]), float(origen["lng"])
    d_lat, d_lng = float(destino["lat"]), float(destino["lng"])
    desired = _bearing(o_lat, o_lng, d_lat, d_lng)

    best: dict | None = None
    best_score = float("inf")

    for bus in buses:
        lat, lng = float(bus["lat"]), float(bus["lng"])
        dist_km = _haversine_km(o_lat, o_lng, lat, lng)
        heading = float(bus["heading"])
        ang = _angle_diff(heading, desired)
        if ang >= 90.0:
            continue
        speed = float(bus.get("speed_kmh", _DEFAULT_SPEED))
        score = dist_km + (ang / 90.0) * 2.0
        if score < best_score:
            best_score = score
            eta_min = max(1, round((dist_km / max(speed, 1.0)) * 60))
            best = {
                "id": bus["id"],
                "linea": bus["linea"],
                "viene_de": bus.get("viene_de") or bus.get("origen_linea") or "",
                "eta_min": eta_min,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
            }
    return best
