# HackaGrokBot-S2L2

Demo hackathon: rutas de bus en Barranquilla.

**Flujo:** usuario escribe o dicta en el chat → (mock/backend) origen/destino + ruta → mapa Leaflet + ETA + alerta de reporte.

## Frontend (rama Sam / PR mic+UI)

```bash
cd Frontend
npm install
npm run dev
```

Abre la URL de Vite (por defecto `http://localhost:5173`).

### Micrófono

- Botón 🎤 junto al input.
- Usa la Web Speech API (`SpeechRecognition`) con `lang: es-CO`.
- El dictado llena el input; tú confirmas con **Enviar**.
- Mejor en Chrome/Edge. Si el navegador no soporta voz, el chat por texto sigue igual.

### Mock vs backend

En `Frontend/src/App.jsx`:

- `USE_MOCK = true` — respuesta simulada (demo sin backend).
- `USE_MOCK = false` — POST a `BACKEND_URL` (`http://localhost:8000/api/ruta`) con `{ mensaje }`.

Contrato esperado del backend (mismo shape del mock): `origen`, `destino`, `ruta`, `eta_base`, `ajuste_reportes`, `eta_final`, `alerta`.

## Roles (doc Proyecto hack)

- Peñata — backend + API rutas
- Samuel — frontend / mapa
- Lewis — bot NLP Grok (`origen`, `destino`, `restriccion`)
- Sebas — mock reportes / ETA
