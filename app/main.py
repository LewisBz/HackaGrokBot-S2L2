"""Orquestador FastAPI - modular monolith Rutas Barranquilla."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from nlp.extractor import extract
from reportes import ajustar
from rutas import fetch_route, geocode
from transporte import match_buses

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


@app.get("/health")
def health():
    return {"ok": True}


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
    transporte = match_buses(
        origen_name,
        destino_name,
        origen_coords=origen,
        destino_coords=destino,
        limit=5,
    )

    return {
        "origen": origen,
        "destino": destino,
        "ruta": route["ruta"],
        "eta_base": route["eta_base"],
        "ajuste_reportes": adj["ajuste_reportes"],
        "eta_final": adj["eta_final"],
        "alerta": adj["alerta"],
        "extract": extracted,
        "transporte": transporte,
    }
