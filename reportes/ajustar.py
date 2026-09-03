"""Ajuste de ETA segun reportes de zona."""
from __future__ import annotations

import json
from pathlib import Path

_DATA_PATH = Path(__file__).with_name("data.json")


def _load_reportes() -> list[dict]:
    with _DATA_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def ajustar(origen: str | None, destino: str | None, restriccion: str | None, eta_base: int | float) -> dict:
    reportes = _load_reportes()
    chosen = None

    candidates = [z for z in (restriccion, origen, destino) if z]
    for zona in candidates:
        for r in reportes:
            if r["zona"] == zona:
                chosen = r
                break
        if chosen is not None:
            break

    if chosen is None:
        chosen = max(reportes, key=lambda r: r["severidad"])

    ajuste = int(chosen["minutos"])
    return {
        "ajuste_reportes": ajuste,
        "eta_final": int(eta_base) + ajuste,
        "alerta": chosen["alerta"],
    }
