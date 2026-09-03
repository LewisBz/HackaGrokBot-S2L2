"""Geocoding de lugares de Barranquilla (dict local + Nominatim)."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

PLACES: dict[str, dict[str, float]] = {
    "Centro": {"lat": 10.9639, "lng": -74.7964},
    "Soledad": {"lat": 10.918, "lng": -74.767},
    "Plaza de la Paz": {"lat": 10.9878, "lng": -74.7889},
    "Aeropuerto": {"lat": 10.8896, "lng": -74.7808},
    "Mercado": {"lat": 10.979, "lng": -74.777},
    "Boston": {"lat": 11.004, "lng": -74.807},
    "Riomar": {"lat": 11.014, "lng": -74.828},
    "Prado": {"lat": 10.998, "lng": -74.807},
    "Uninorte": {"lat": 11.0198, "lng": -74.8508},
    "Playa": {"lat": 11.0006, "lng": -74.9548},
}

# Cache en memoria: nombre normalizado -> resultado
_CACHE: dict[str, dict | None] = {}

# Barranquilla viewbox: left,top,right,bottom (lon/lat)
_VIEWBOX = "-75.0,11.08,-74.70,10.85"
_USER_AGENT = "HackaGrokBot-S2L2"


def _lookup_local(nombre: str) -> dict | None:
    """Busca en PLACES con match exacto o case-insensitive."""
    coords = PLACES.get(nombre)
    if coords is not None:
        return {"nombre": nombre, "lat": coords["lat"], "lng": coords["lng"]}
    lower = nombre.casefold()
    for key, coords in PLACES.items():
        if key.casefold() == lower:
            return {"nombre": key, "lat": coords["lat"], "lng": coords["lng"]}
    return None


def _nominatim(nombre: str) -> dict | None:
    """Consulta Nominatim (Colombia, vista Barranquilla)."""
    params = urllib.parse.urlencode(
        {
            "q": nombre,
            "format": "json",
            "countrycodes": "co",
            "viewbox": _VIEWBOX,
            "bounded": "1",
            "limit": "1",
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if not data:
            return None
        hit = data[0]
        return {
            "nombre": nombre,
            "lat": float(hit["lat"]),
            "lng": float(hit["lon"]),
        }
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        json.JSONDecodeError,
        KeyError,
        ValueError,
        OSError,
    ):
        return None


def geocode(nombre: str | None) -> dict | None:
    """Devuelve {nombre, lat, lng} o None. Dict local primero, luego Nominatim."""
    if not nombre:
        return None
    key = nombre.strip()
    if not key:
        return None

    local = _lookup_local(key)
    if local is not None:
        return local

    cache_key = key.casefold()
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    result = _nominatim(key)
    _CACHE[cache_key] = result
    return result
