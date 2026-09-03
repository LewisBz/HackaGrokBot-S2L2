# HackaGrokBot-S2L2 - Rutas Barranquilla

Modular monolith: chat → NLP → OSRM → reportes → **transporte (buses)** → mapa + **simulación de viaje**.

## Tree

```
app/           # FastAPI orchestrator (POST /api/ruta)
nlp/           # Lewis - extract origen/destino/restriccion
rutas/         # Penata - geocode + OSRM
reportes/      # Sebas - ajuste ETA por zona
transporte/    # Matching de líneas Sobusa / Trasalianco / La Carolina / Sodis / Montalvo
Frontend/      # Samuel - Vite UI + simulación Leaflet
tests/         # pytest / unittest
server.js      # Express OSRM helper (puerto 3000, opcional)
```

## Contrato POST /api/ruta

Request:

```json
{"mensaje": "quiero ir del Centro a Soledad"}
```

Response:

```json
{
  "origen": {"nombre": "Centro", "lat": 10.9639, "lng": -74.7964},
  "destino": {"nombre": "Soledad", "lat": 10.918, "lng": -74.767},
  "ruta": [[10.96, -74.79], [10.91, -74.76]],
  "eta_base": 25,
  "ajuste_reportes": 5,
  "eta_final": 30,
  "alerta": "Trafico moderado en Centro (+5 min)",
  "extract": {"origen": "Centro", "destino": "Soledad", "restriccion": null},
  "transporte": [
    {
      "empresa": "Sobusa",
      "codigo": "C13",
      "nombre": "Via 40 / Calle 76 -> Nevada Soledad",
      "paradas": ["Uninorte", "Riomar", "Prado", "Plaza de la Paz", "Centro", "Mercado", "Soledad"],
      "paradas_clave": ["Uninorte", "Centro", "Soledad"],
      "color": "#E11D48",
      "motivo": "Cubre Centro y Soledad en el mismo sentido...",
      "score": 92,
      "demo_inventado": false
    }
  ]
}
```

422 si faltan origen o destino.

El dataset de buses esta en `transporte/data/lineas_barranquilla.json` (curado para demo; **no es GTFS oficial**). Lineas de **Montalvo** con poca data publica se marcan `demo_inventado: true`.

## Como correr el demo

FastAPI :8000, Frontend :5173, Express :3000 opcional.

## UI + comentarios (rama Backend)

SPA Inicio Buscar Comentarios. SSE /api/comentarios/stream.
