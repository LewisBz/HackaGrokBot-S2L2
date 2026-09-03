"""Almacén en memoria + endpoints REST/SSE para comentarios de rutas."""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/comentarios", tags=["comentarios"])

_comments: list[dict[str, Any]] = []
_subscribers: list[asyncio.Queue] = []
_lock = asyncio.Lock()


class ComentarioIn(BaseModel):
    autor: str = Field(..., min_length=1, max_length=80)
    texto: str = Field(..., min_length=1, max_length=500)
    ruta_key: str = Field(..., min_length=1, max_length=120)
    empresa: str | None = Field(default=None, max_length=80)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def seed_comments() -> None:
    """Carga comentarios semilla de Barranquilla (idempotente)."""
    if _comments:
        return
    samples = [
        {
            "autor": "Camila R.",
            "texto": "El C13 de Sobusa llega rápido de Uninorte al Centro en hora valle. ¡Recomendado!",
            "ruta_key": "Uninorte→Centro",
            "empresa": "Sobusa",
        },
        {
            "autor": "Andrés M.",
            "texto": "Centro → Soledad: ojo con el tráfico en la muralla después de las 5pm.",
            "ruta_key": "Centro→Soledad",
            "empresa": "Sobusa",
        },
        {
            "autor": "Valentina P.",
            "texto": "La B15 de Sodis para Soledad está limpia y el conductor súper amable.",
            "ruta_key": "Centro→Soledad",
            "empresa": "Sodis",
        },
        {
            "autor": "Luis Peñata",
            "texto": "Riomar → Prado en Trasalianco: paradas claras, buena señalización.",
            "ruta_key": "Riomar→Prado",
            "empresa": "Trasalianco",
        },
        {
            "autor": "Sebas",
            "texto": "Si vas al aeropuerto, sal con tiempo: el corredor se satura con lluvia.",
            "ruta_key": "Centro→Aeropuerto",
            "empresa": None,
        },
        {
            "autor": "Sam",
            "texto": "Demo hackathon: la simulación del bus en el mapa queda brutal 🚌✨",
            "ruta_key": "general",
            "empresa": None,
        },
    ]
    base = time.time() - 3600
    for i, s in enumerate(samples):
        _comments.append(
            {
                "id": str(uuid.uuid4()),
                "ruta_key": s["ruta_key"],
                "autor": s["autor"],
                "texto": s["texto"],
                "empresa": s.get("empresa"),
                "created_at": datetime.fromtimestamp(base + i * 420, tz=timezone.utc).isoformat(),
            }
        )


async def _broadcast(item: dict[str, Any]) -> None:
    dead: list[asyncio.Queue] = []
    for q in list(_subscribers):
        try:
            q.put_nowait(item)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        if q in _subscribers:
            _subscribers.remove(q)


@router.get("")
async def list_comentarios(ruta: str | None = Query(default=None, alias="ruta")):
    items = list(_comments)
    if ruta:
        key = ruta.strip().lower()
        items = [c for c in items if c["ruta_key"].lower() == key or key in c["ruta_key"].lower()]
    items.sort(key=lambda c: c["created_at"], reverse=True)
    return {"comentarios": items, "total": len(items)}


@router.post("")
async def create_comentario(body: ComentarioIn):
    item = {
        "id": str(uuid.uuid4()),
        "ruta_key": body.ruta_key.strip(),
        "autor": body.autor.strip(),
        "texto": body.texto.strip(),
        "empresa": (body.empresa.strip() if body.empresa else None),
        "created_at": _now_iso(),
    }
    async with _lock:
        _comments.append(item)
    await _broadcast(item)
    return item


@router.get("/stream")
async def stream_comentarios():
    """Server-Sent Events: empuja cada comentario nuevo."""
    from fastapi.responses import StreamingResponse

    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    _subscribers.append(queue)

    async def event_gen():
        try:
            # hello / keep-alive hint
            yield f": connected {int(time.time())}\n\n"
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=20.0)
                    payload = json.dumps(item, ensure_ascii=False)
                    yield f"event: comentario\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield f": keepalive {int(time.time())}\n\n"
        finally:
            if queue in _subscribers:
                _subscribers.remove(queue)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
