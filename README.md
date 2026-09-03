# HackaGrokBot-S2L2

Demo hackathon: rutas de bus en Barranquilla.

**Flujo UI:** chat/mic → `POST /api/ruta` `{ "mensaje" }` → NLP extract → geocode/OSRM → reportes ETA → mapa.

## Frontend (Samuel) — rama `Sam`

```bash
cd Frontend
npm install
cp .env.example .env   # opcional
npm run dev
```

Vite en `http://localhost:5173` hace **proxy** a `http://127.0.0.1:8000` (`/api`, `/extract`, `/health`).

### Acoplamiento backend + NLP

Contrato (orquestador en `app/main.py` del monolito):

```http
POST /api/ruta
Content-Type: application/json

{"mensaje":"quiero ir del Centro a Soledad"}
```

Respuesta esperada:

```json
{
  "origen": {"nombre": "Centro", "lat": 10.96, "lng": -74.79},
  "destino": {"nombre": "Soledad", "lat": 10.91, "lng": -74.76},
  "ruta": [[10.96, -74.79], [10.91, -74.76]],
  "eta_base": 25,
  "ajuste_reportes": 5,
  "eta_final": 30,
  "alerta": "...",
  "extract": {"origen": "Centro", "destino": "Soledad", "restriccion": null}
}
```

- `422` si el NLP no saca origen y destino → la UI lo muestra en el chat.
- Lugares NLP: Centro, Soledad, Plaza de la Paz, Aeropuerto, Mercado, Boston, Riomar, Prado, Uninorte.

Backend (rama `feature/monolith-scaffold` o cuando esté en main):

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Mock sin backend: en `.env` pon `VITE_USE_MOCK=true`.

### Micrófono

Botón 🎤 · Web Speech API `es-CO` · llena el input · Enviar confirma.

## Roles

| Módulo | Owner | Rol |
|--------|-------|-----|
| Frontend | Samuel | chat + mapa + mic |
| nlp | Lewis | extract origen/destino/restricción |
| rutas | Peñata | geocode + OSRM |
| reportes | Sebas | ajuste ETA |
| app | integración | `POST /api/ruta` |
