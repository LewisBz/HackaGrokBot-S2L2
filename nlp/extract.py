"""Extract origin, destination, and via-constraints from Spanish trip messages."""
from __future__ import annotations

import re
import unicodedata
from typing import Any

# Longer aliases first so "la universidad" wins over "universidad".
PLACE_ALIASES: list[tuple[str, str]] = [
    ("la universidad", "universidad"),
    ("el aeropuerto", "aeropuerto"),
    ("la playa", "playa"),
    ("el centro", "centro"),
    ("universidad", "universidad"),
    ("aeropuerto", "aeropuerto"),
    ("uninorte", "universidad"),
    ("playa", "playa"),
    ("centro", "centro"),
    ("terminal", "terminal"),
    ("mercado", "mercado"),
]

_DE_A = re.compile(
    r"\b(?:del?|desde)\s+(?P<origen>.+?)\s+(?:hacia|hasta|al?)\s+(?P<destino>.+?)(?=\s+(?:que|el bus|pero)|[?.!,]|$)",
    re.IGNORECASE,
)
_SALIR = re.compile(
    r"(?:estoy\s+)?(?:sal(?:go|iendo|ir))\s+(?:de|del)\s+(?P<origen>.+?)(?=\s+y\s+|\s*,\s*|$)",
    re.IGNORECASE,
)
_LLEGAR = re.compile(
    r"(?:como\s+)?(?:necesito\s+)?(?:lleg(?:ar|o)|ir)\s+(?:a|al)\s+(?P<destino>.+?)(?=\s*,|\s+el bus|\s+que\s+|[?.!]|$)",
    re.IGNORECASE,
)
_VIA = re.compile(
    r"(?:que\s+)?pas(?:e|a)n?\s+por\s+(?P<via>la\s+\d+\w*|el\s+\d+\w*|calle\s+\d+|carrera\s+\d+|la\s+[a-z0-9]+)",
    re.IGNORECASE,
)


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower().strip())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text)


def _find_place(span: str) -> str | None:
    s = _norm(span)
    s = re.sub(r"^(el|la|los|las|al|del)\s+", "", s).strip(" .,;:?¿!")
    if not s:
        return None
    for raw, label in PLACE_ALIASES:
        raw_n = _norm(raw)
        if s == _norm(label) or s == raw_n or raw_n in s or s.startswith(_norm(label)):
            return label
    if s in {"bus", "buses", "ruta", "un bus", "el bus"}:
        return None
    if 2 <= len(s) <= 40:
        return s
    return None


def extract(mensaje: str) -> dict[str, Any]:
    if not mensaje or not str(mensaje).strip():
        return {
            "origen": None,
            "destino": None,
            "restriccion": None,
            "falta_info": True,
        }

    text = _norm(mensaje)
    origen = None
    destino = None

    m = _SALIR.search(text)
    if m:
        origen = _find_place(m.group("origen"))

    m = _LLEGAR.search(text)
    if m:
        destino = _find_place(m.group("destino"))

    if origen is None or destino is None:
        m = _DE_A.search(text)
        if m:
            origen = origen or _find_place(m.group("origen"))
            destino = destino or _find_place(m.group("destino"))

    via = _VIA.search(text)
    restriccion = f"que pase por {via.group('via').strip()}" if via else None

    if not origen or not destino:
        return {
            "origen": None,
            "destino": None,
            "restriccion": None,
            "falta_info": True,
        }

    return {"origen": origen, "destino": destino, "restriccion": restriccion}
