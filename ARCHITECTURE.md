# Architecture - Modular Monolith

Este repo es un **modular monolith**: un solo deploy, modulos desacoplados por carpeta.

## Flujo

```
chat (Frontend) -> POST /api/ruta (app) -> nlp.extract -> rutas.geocode/osrm -> reportes.ajustar -> map
```

## Owners

| Modulo   | Owner      | Responsabilidad                       |
|----------|-----------|-------------------------------------------|
| nlp     | Lewis     | Extraer origen, destino, restriccion     |
| rutas    | Penata     | Geocode local + OSRM                   |
| reportes | Sebas      | Ajuste de ETA por alertas de zona      |
| app     | integration| Orquestacion FastAPI /api/ruta          |
| Frontend | Samuel     | UI chat + mapa                         |

## Reglas

- Los modulos (nlp, rutas, reportes) **no se importan entre si**.
- Solo app importa a los demas y orquesta el contrato Samuel.
