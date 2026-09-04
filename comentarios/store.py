"""Comentarios en tiempo real (lista en memoria, máx 100)."""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone

from reportes.ajustar import _load_reportes

_MAX = 100
_lock = threading.Lock()
_items: list[dict] = []

# Zonas conocidas: reportes + nodos del grafo
_REPORT_ZONAS = [r["zona"] for r in _load_reportes()]
ZONAS = sorted(
    set(_REPORT_ZONAS)
    | {
        "Centro",
        "Soledad",
        "Plaza de la Paz",
        "Aeropuerto",
        "Mercado",
        "Boston",
        "Riomar",
        "Prado",
        "Uninorte",
        "Playa",
    }
)


def list_comentarios() -> list[dict]:
    with _lock:
        return list(_items)


def add_comentario(zona: str, texto: str) -> dict:
    zona_clean = (zona or "").strip()
    texto_clean = (texto or "").strip()
    if not zona_clean or not texto_clean:
        raise ValueError("zona y texto son requeridos")
    if len(texto_clean) > 500:
        raise ValueError("texto demasiado largo (máx 500)")

    item = {
        "id": str(uuid.uuid4()),
        "zona": zona_clean,
        "texto": texto_clean,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with _lock:
        _items.insert(0, item)
        del _items[_MAX:]
    return item
