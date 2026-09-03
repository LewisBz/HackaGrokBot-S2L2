"""Matching de líneas de bus por origen/destino (dataset curado)."""
from __future__ import annotations

import json
import math
from pathlib import Path

_DATA_PATH = Path(__file__).with_name("data") / "lineas_barranquilla.json"

# Alias suaves para matching (NLP canónico + variantes)
_ALIASES: dict[str, str] = {
    "centro": "Centro",
    "el centro": "Centro",
    "soledad": "Soledad",
    "uninorte": "Uninorte",
    "universidad del norte": "Uninorte",
    "prado": "Prado",
    "el prado": "Prado",
    "riomar": "Riomar",
    "rio mar": "Riomar",
    "aeropuerto": "Aeropuerto",
    "aeropuerto ernesto cortissoz": "Aeropuerto",
    "mercado": "Mercado",
    "mercado publico": "Mercado",
    "plaza de la paz": "Plaza de la Paz",
    "plaza la paz": "Plaza de la Paz",
    "boston": "Boston",
    "miramar": "Miramar",
}


def _load_lineas() -> list[dict]:
    with _DATA_PATH.open(encoding="utf-8") as f:
        payload = json.load(f)
    return list(payload.get("lineas", []))


def canonicalize_place(nombre: str | None) -> str | None:
    if not nombre:
        return None
    key = str(nombre).strip().lower()
    if key in _ALIASES:
        return _ALIASES[key]
    # Title-case fallback for already-canonical names
    for canon in set(_ALIASES.values()):
        if canon.lower() == key:
            return canon
    return str(nombre).strip()


def _haversine_km(a: dict, b: dict) -> float:
    lat1, lon1 = math.radians(a["lat"]), math.radians(a["lng"])
    lat2, lon2 = math.radians(b["lat"]), math.radians(b["lng"])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def match_buses(
    origen: str | None,
    destino: str | None,
    origen_coords: dict | None = None,
    destino_coords: dict | None = None,
    limit: int = 5,
) -> list[dict]:
    """Devuelve buses rankeados que cubren origen y destino (o el corredor).

    Cada item: empresa, codigo, nombre, paradas, color, motivo, score, demo_inventado.
    """
    o = canonicalize_place(origen)
    d = canonicalize_place(destino)
    if not o or not d:
        return []

    results: list[dict] = []
    for linea in _load_lineas():
        stops = list(linea.get("paradas") or [])
        stops_l = [s.lower() for s in stops]
        try:
            i_o = stops_l.index(o.lower())
            i_d = stops_l.index(d.lower())
        except ValueError:
            # Cobertura parcial: una punta exacta + otra en corredor cercano por nombre
            has_o = o.lower() in stops_l
            has_d = d.lower() in stops_l
            if not (has_o or has_d):
                continue
            # Solo una punta: score bajo (corredor)
            score = 35 if (has_o or has_d) else 0
            if score == 0:
                continue
            missing = d if has_o else o
            motivo = (
                f"Cubre {o if has_o else d} en el corredor "
                f"{linea.get('corredor') or linea['nombre']}; "
                f"revisa transbordo hacia {missing}."
            )
            results.append(_pack(linea, stops, score, motivo))
            continue

        gap = abs(i_d - i_o)
        # Ambas paradas en la misma línea
        score = 100 - gap * 4
        if i_o < i_d:
            sentido = " → ".join(stops[i_o : i_d + 1])
            motivo = f"Cubre {o} y {d} en el mismo sentido ({gap} tramo(s)): {sentido}."
        else:
            sentido = " → ".join(stops[i_d : i_o + 1][::-1])
            motivo = f"Cubre {o} y {d} (sentido inverso, {gap} tramo(s)): {sentido}."

        # Bonus suave si coords están cerca (opcional)
        if origen_coords and destino_coords and "lat" in origen_coords and "lat" in destino_coords:
            dist = _haversine_km(origen_coords, destino_coords)
            if dist < 8:
                score += 5
            elif dist > 20:
                score -= 5

        if linea.get("demo_inventado"):
            score -= 8
            motivo += " [dataset demo]"

        results.append(_pack(linea, stops, score, motivo))

    results.sort(key=lambda r: (-r["score"], r["empresa"], r["codigo"]))
    # Deduplicate by empresa+codigo
    seen: set[str] = set()
    ranked: list[dict] = []
    for item in results:
        key = f"{item['empresa']}:{item['codigo']}"
        if key in seen:
            continue
        seen.add(key)
        ranked.append(item)
        if len(ranked) >= limit:
            break
    return ranked


def _pack(linea: dict, stops: list, score: float, motivo: str) -> dict:
    return {
        "empresa": linea["empresa"],
        "codigo": linea["codigo"],
        "nombre": linea["nombre"],
        "paradas": stops,
        "paradas_clave": [stops[0], stops[len(stops) // 2], stops[-1]] if stops else [],
        "color": linea.get("color", "#64748B"),
        "corredor": linea.get("corredor"),
        "demo_inventado": bool(linea.get("demo_inventado")),
        "score": int(score),
        "motivo": motivo,
    }
