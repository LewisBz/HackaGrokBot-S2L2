# HackaGrokBot-S2L2 - Rutas Barranquilla

Modular monolith: chat -> NLP -> OSRM -> reportes -> mapa.

## Tree

```
app/           # FastAPI orchestrator (POST /api/ruta)
nlp/           # Lewis - extract origen/destino/restriccion
rutas/         # Penata - geocode + OSRM
reportes/      # Sebas - ajuste ETA por zona
Frontend/      # Samuel - Vite UI
tests/         # pytest
```

## Contrato POST /api/ruta

Request:

```json
{"mensaje": "quiero ir del Centro a Soledad"}
```

Response (Samuel):

```json
{
  "origen": {"nombre": "Centro", "lat": 10.9639, "lng": -74.7964},
  "destino": {"nombre": "Soledad", "lat": 10.918, "lng": -74.767},
  "ruta": [[10.96, -74.79], [10.91, -74.76]],
  "eta_base": 25,
  "ajuste_reportes": 5,
  "eta_final": 30,
  "alerta": "Trafico moderado en Centro (+5 min)",
  "extract": {"origen": "Centro", "destino": "Soledad", "restriccion": null}
}
```

422 si faltan origen o destino.


## Como correr

Backend:

```
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```
cd Frontend
npm install
# set USE_MOCK=false (env / .env)
npm run dev
```

Health: GET http://127.0.0.1:8000/health -> {"ok": true}

## Workflow

- main solo recibe cambios via Pull Requests.
- Ramas: feature/<modulo>-<cambio> (ej. feature/rutas-osrm).
- No commits de node_modules/ (esta en .gitignore).
