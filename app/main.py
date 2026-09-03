"""Orquestador FastAPI - modular monolith Rutas Barranquilla."""
from __future__ import annotations

import threading
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from buses import recommend, snapshot, tick
from nlp.extractor import extract
from reportes import ajustar
from rutas import fetch_route, geocode

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


@app.post("/extract")
def post_extract(body: ExtractBody):
    return extract(body.texto)


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
            detail="No se pudo geocodificar origen o destino",
        )

    route = fetch_route(origen, destino)
    adj = ajustar(origen_name, destino_name, restriccion, route["eta_base"])
    bus_recomendado = recommend(origen, destino)

    return {
        "origen": origen,
        "destino": destino,
        "ruta": route["ruta"],
        "eta_base": route["eta_base"],
        "ajuste_reportes": adj["ajuste_reportes"],
        "eta_final": adj["eta_final"],
        "alerta": adj["alerta"],
        "extract": extracted,
        "bus_recomendado": bus_recomendado,
    }
