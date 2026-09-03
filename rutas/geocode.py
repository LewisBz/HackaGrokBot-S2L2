"""Geocoding de lugares de Barranquilla (dict local)."""
from __future__ import annotations

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
}


def geocode(nombre: str | None) -> dict | None:
    if not nombre:
        return None
    coords = PLACES.get(nombre)
    if coords is None:
        return None
    return {"nombre": nombre, "lat": coords["lat"], "lng": coords["lng"]}
