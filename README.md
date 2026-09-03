# HackaGrokBot-S2L2

Módulo NLP de una app de rutas de bus en Barranquilla.

El backend manda un mensaje en lenguaje natural. Este servicio extrae origen, destino y restricciones.

## Contrato

`POST /extract`

```json
{ "mensaje": "Estoy saliendo de la universidad y necesito llegar al centro, el bus que pasa por la 51 me sirve?" }
```

Con info suficiente:

```json
{ "origen": "universidad", "destino": "centro", "restriccion": "que pase por la 51" }
```

Sin info suficiente:

```json
{ "origen": null, "destino": null, "restriccion": null, "falta_info": true }
```

`restriccion` es `null` si el usuario no pide pasar por un lugar (ej. la 51).

## Correr

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn nlp.api:app --reload --port 8000
```

```bash
curl -s http://localhost:8000/extract \
  -H 'Content-Type: application/json' \
  -d '{"mensaje":"¿Cómo llego del aeropuerto a la playa?"}'
```

Health: `GET /health`

Tests: `pytest -q`

## Docker

```bash
docker build -t nlp-ruteo .
docker run -p 8000:8000 nlp-ruteo
```
