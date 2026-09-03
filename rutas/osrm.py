"""Cliente OSRM publico para rutas driving."""
from __future__ import annotations

import json
import urllib.error
import urllib.request


def fetch_route(origen: dict, destino: dict) -> dict:
    """Devuelve {ruta: [[lat,lng],...], eta_base: minutes}."""
    o_lat, o_lng = origen["lat"], origen["lng"]
    d_lat, d_lng = destino["lat"], destino["lng"]
    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{o_lng},{o_lat};{d_lng},{d_lat}"
        f"?overview=full&geometries=geojson"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HackaGrokBot-S2L2"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        route = data["routes"][0]
        coords = route["geometry"]["coordinates"]
        ruta = [[lat, lng] for lng, lat in coords]
        eta_base = round(route["duration"] / 60)
        return {"ruta": ruta, "eta_base": eta_base}
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError, TimeoutError, json.JSONDecodeError, OSError):
        return {
            "ruta": [[o_lat, o_lng], [d_lat, d_lng]],
            "eta_base": 20,
        }
