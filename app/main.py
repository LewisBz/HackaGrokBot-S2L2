"""Orquestador FastAPI - modular monolith Rutas Barranquilla."""
from __future__ import annotations

import threading
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from buses import recommend, snapshot, tick
from comentarios import ZONAS, add_comentario, list_comentarios
from nlp.extractor import extract
from reportes import ajustar
from rutas import (
    fetch_route,
    geocode,
    graph_full,
    dijkstra,
    path_as_grafo,
    resolve_endpoint,
)
from rutas.graph import NODES

app = FastAPI(title="Rutas Barranquilla")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtractBody(BaseModel):
    texto: str


class RutaBody(BaseModel):
    mensaje: str


class ComentarioBody(BaseModel):
    zona: str = Field(..., min_length=1)
    texto: str = Field(..., min_length=1, max_length=500)


def _bus_ticker() -> None:
    while True:
        try:
            tick()
        except Exception:
            pass
        time.sleep(1.0)


@app.on_event("startup")
def _start_bus_sim() -> None:
    t = threading.Thread(target=_bus_ticker, name="bus-ticker", daemon=True)
    t.start()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/buses")
def get_buses():
    return snapshot()


@app.get("/api/grafo")
def get_grafo():
    return graph_full()


@app.get("/api/comentarios")
def get_comentarios():
    return {"items": list_comentarios(), "zonas": ZONAS}


@app.post("/api/comentarios")
def post_comentario(body: ComentarioBody):
    try:
        item = add_comentario(body.zona, body.texto)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return item


@app.post("/extract")
def post_extract(body: ExtractBody):
    return extract(body.texto)


def _concat_osrm(path_ids: list[str]) -> tuple[list, int]:
    """OSRM entre nodos consecutivos; concatena polilineas y suma ETA."""
    full: list = []
    eta = 0
    for i in range(len(path_ids) - 1):
        a = NODES[path_ids[i]]
        b = NODES[path_ids[i + 1]]
        seg = fetch_route(a, b)
        pts = seg["ruta"]
        if full and pts:
            pts = pts[1:] if pts[0] == full[-1] else pts
        full.extend(pts)
        eta += int(seg["eta_base"])
    if not full and path_ids:
        n = NODES[path_ids[0]]
        full = [[n["lat"], n["lng"]]]
    return full, eta


@app.post("/api/ruta")
def post_ruta(body: RutaBody):
    extracted = extract(body.mensaje)
    origen_name = extracted.get("origen")
    destino_name = extracted.get("destino")
    restriccion = extracted.get("restriccion")

    if not origen_name or not destino_name:
        raise HTTPException(
            status_code=422,
            detail="Se requieren origen y destino en el mensaje",
        )

    origen = geocode(origen_name)
    destino = geocode(destino_name)
    if origen is None or destino is None:
        raise HTTPException(
            status_code=422,
            detail="No se pudo geocodificar origen o destino (solo Barranquilla)",
        )

    node_o = resolve_endpoint(origen)
    node_d = resolve_endpoint(destino)
    if node_o is None or node_d is None:
        raise HTTPException(
            status_code=422,
            detail="Origen o destino lejos del grafo (>~2 km de un POI)",
        )

    path_ids = dijkstra(node_o["id"], node_d["id"])
    if not path_ids:
        raise HTTPException(status_code=422, detail="Sin camino en el grafo")

    grafo = path_as_grafo(path_ids)

    if len(path_ids) == 1:
        n = NODES[path_ids[0]]
        ruta = [[n["lat"], n["lng"]]]
        eta_base = 0
    else:
        ruta, eta_base = _concat_osrm(path_ids)

    adj = ajustar(origen_name, destino_name, restriccion, eta_base)
    bus_recomendado = recommend(origen, destino)

    return {
        "origen": origen,
        "destino": destino,
        "ruta": ruta,
        "eta_base": eta_base,
        "ajuste_reportes": adj["ajuste_reportes"],
        "eta_final": adj["eta_final"],
        "alerta": adj["alerta"],
        "extract": extracted,
        "bus_recomendado": bus_recomendado,
        "grafo": grafo,
        "nodo_origen": node_o,
        "nodo_destino": node_d,
    }
