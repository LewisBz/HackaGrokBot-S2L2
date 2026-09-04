"""Geocoding de lugares de Barranquilla (dict local + Nominatim)."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

# tipo: troncal | barrio | poi
PLACES: dict[str, dict] = {
    # POIs
    "Centro": {"lat": 10.9639, "lng": -74.7964, "tipo": "poi"},
    "Soledad": {"lat": 10.9180, "lng": -74.7670, "tipo": "poi"},
    "Plaza de la Paz": {"lat": 10.9878, "lng": -74.7889, "tipo": "poi"},
    "Aeropuerto": {"lat": 10.8896, "lng": -74.7808, "tipo": "poi"},
    "Mercado": {"lat": 10.9790, "lng": -74.7770, "tipo": "poi"},
    "Uninorte": {"lat": 11.0198, "lng": -74.8508, "tipo": "poi"},
    "Playa": {"lat": 11.0006, "lng": -74.9548, "tipo": "poi"},
    "Buenavista": {"lat": 11.0115, "lng": -74.8275, "tipo": "poi"},
    "Terminal de Transportes": {"lat": 10.9105, "lng": -74.7805, "tipo": "poi"},
    # Barrios
    "Boston": {"lat": 11.0040, "lng": -74.8070, "tipo": "barrio"},
    "Riomar": {"lat": 11.0140, "lng": -74.8280, "tipo": "barrio"},
    "Prado": {"lat": 10.9980, "lng": -74.8070, "tipo": "barrio"},
    "Villa Santos": {"lat": 11.0165, "lng": -74.8355, "tipo": "barrio"},
    "Villa Country": {"lat": 11.0085, "lng": -74.8155, "tipo": "barrio"},
    "Alto Prado": {"lat": 11.0025, "lng": -74.8120, "tipo": "barrio"},
    "Ciudad Jardín": {"lat": 10.9955, "lng": -74.8205, "tipo": "barrio"},
    "El Recreo": {"lat": 10.9920, "lng": -74.8010, "tipo": "barrio"},
    "Las Flores": {"lat": 11.0255, "lng": -74.8450, "tipo": "barrio"},
    "Calle 72": {"lat": 11.0045, "lng": -74.8190, "tipo": "barrio"},
    "Calle 84": {"lat": 11.0120, "lng": -74.8305, "tipo": "barrio"},
    # Troncal Murillo (aprox. a lo largo de Murillo / Calle 30-45 zona)
    "Portal de Soledad": {"lat": 10.9055, "lng": -74.7755, "tipo": "troncal"},
    "Pacho Galán": {"lat": 10.9120, "lng": -74.7780, "tipo": "troncal"},
    "Pedro Ramayá": {"lat": 10.9205, "lng": -74.7815, "tipo": "troncal"},
    "Estadio Metropolitano": {"lat": 10.9285, "lng": -74.7850, "tipo": "troncal"},
    "Joaquín Barrios Polo": {"lat": 10.9355, "lng": -74.7885, "tipo": "troncal"},
    "Buenos Aires": {"lat": 10.9425, "lng": -74.7905, "tipo": "troncal"},
    "La Ocho": {"lat": 10.9495, "lng": -74.7920, "tipo": "troncal"},
    "La Catorce": {"lat": 10.9565, "lng": -74.7935, "tipo": "troncal"},
    "La Veintiuna": {"lat": 10.9635, "lng": -74.7945, "tipo": "troncal"},
    "Atlántico": {"lat": 10.9705, "lng": -74.7955, "tipo": "troncal"},
    "Chiquinquirá": {"lat": 10.9775, "lng": -74.7965, "tipo": "troncal"},
    "La Arenosa": {"lat": 10.9845, "lng": -74.7975, "tipo": "troncal"},
    # Troncal Olaya Herrera (Cra 46)
    "Parque Cultural del Caribe": {"lat": 10.9685, "lng": -74.7815, "tipo": "troncal"},
    "Barrio Abajo": {"lat": 10.9755, "lng": -74.7855, "tipo": "troncal"},
    "La Catedral": {"lat": 10.9825, "lng": -74.7895, "tipo": "troncal"},
    "Alfredo Correa de Andréis": {"lat": 10.9905, "lng": -74.7935, "tipo": "troncal"},
    "Esthercita Forero": {"lat": 10.9975, "lng": -74.7975, "tipo": "troncal"},
    "Joe Arroyo": {"lat": 11.0045, "lng": -74.8015, "tipo": "troncal"},
}

_CACHE: dict[str, dict | None] = {}
_VIEWBOX = "-75.0,11.08,-74.70,10.85"
_USER_AGENT = "HackaGrokBot-S2L2"
_LAT_MIN, _LAT_MAX = 10.85, 11.08
_LNG_MIN, _LNG_MAX = -75.0, -74.70


def in_barranquilla(lat: float, lng: float) -> bool:
    return _LAT_MIN <= lat <= _LAT_MAX and _LNG_MIN <= lng <= _LNG_MAX


def _lookup_local(nombre: str) -> dict | None:
    coords = PLACES.get(nombre)
    if coords is not None:
        return {"nombre": nombre, "lat": coords["lat"], "lng": coords["lng"]}
    lower = nombre.casefold()
    for key, coords in PLACES.items():
        if key.casefold() == lower:
            return {"nombre": key, "lat": coords["lat"], "lng": coords["lng"]}
    return None


def _nominatim(nombre: str) -> dict | None:
    params = urllib.parse.urlencode(
        {
            "q": f"{nombre}, Barranquilla",
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
        lat = float(hit["lat"])
        lng = float(hit["lon"])
        if not in_barranquilla(lat, lng):
            return None
        return {"nombre": nombre, "lat": lat, "lng": lng}
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
