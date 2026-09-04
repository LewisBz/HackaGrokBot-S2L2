import { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import BusLayer from './components/BusLayer'
import RouteCard from './components/RouteCard'
import GraphLayer from './components/GraphLayer'

// Fix Leaflet default icons under Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const BACKEND_URL = '/api/ruta'
const USE_MOCK = false
const BARRANQUILLA_CENTER = [10.9878, -74.7889]

function mockResponse() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        origen: { nombre: 'Universidad del Norte', lat: 11.0198, lng: -74.8508 },
        destino: { nombre: 'Centro de Barranquilla', lat: 10.9639, lng: -74.7964 },
        ruta: [
          [11.0198, -74.8508],
          [11.005, -74.83],
          [10.99, -74.81],
          [10.9639, -74.7964],
        ],
        eta_base: 28,
        ajuste_reportes: 7,
        eta_final: 35,
        alerta: '⚠️ Reporte reciente: congestión fuerte en la Vía 40.',
        bus_recomendado: {
          id: 'GPS-12',
          linea: 'A8-1',
          lat: 11.01,
          lng: -74.84,
          heading: 120,
          speed_kmh: 28,
          viene_de: 'Uninorte',
          hacia: 'Centro',
          eta_min: 6,
          dist_km: 1.2,
        },
      })
    }, 600)
  })
}

async function callBackend(texto) {
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: texto }),
  })
  if (!res.ok) {
    let detail = 'Error del backend: ' + res.status
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      /* keep status text */
    }
    throw new Error(detail)
  }
  return res.json()
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds?.length) map.fitBounds(bounds, { padding: [48, 48] })
  }, [bounds, map])
  return null
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text:
        'Hola — dime origen y destino. Puedes usar nombres de lugares o direcciones de calle. Ej: "Uninorte al Centro" o "Cra 51 #80-20, Barranquilla hasta el Prado".',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [routeData, setRouteData] = useState(null)
  const [busesOnline, setBusesOnline] = useState(null)
  const [busCount, setBusCount] = useState(0)
  const chatLogRef = useRef(null)

  const onBusStatus = useCallback(({ ok, count }) => {
    setBusesOnline(ok)
    setBusCount(count)
  }, [])

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
    }
  }, [messages, loading])

  async function handleSubmit(e) {
    e.preventDefault()
    const texto = input.trim()
    if (!texto) return

    setMessages((prev) => [...prev, { from: 'user', text: texto }])
    setInput('')
    setLoading(true)

    try {
      const data = USE_MOCK ? await mockResponse(texto) : await callBackend(texto)
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: `Ruta encontrada: ${data.origen.nombre} → ${data.destino.nombre}`,
        },
        ...(data.alerta ? [{ from: 'alert', text: data.alerta }] : []),
      ])
      setRouteData(data)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: 'Ups, algo falló: ' + err.message },
      ])
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const bounds = routeData ? routeData.ruta.map((p) => [p[0], p[1]]) : null

  return (
    <div className="app">
      <aside className="panel">
        <header className="app-header">
          <span className="app-header-title">🚌 Rutas Barranquilla</span>
          {busesOnline === false && (
            <span className="chip chip--warn" title="No se pudo leer /api/buses">
              Buses offline
            </span>
          )}
          {busesOnline === true && (
            <span className="chip chip--ok">{busCount} en vivo</span>
          )}
        </header>

        <div className="chat-log" ref={chatLogRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.from}`}>
              {m.text}
            </div>
          ))}
          {loading && <div className="msg bot loading">Buscando ruta...</div>}
        </div>

        {routeData && (
          <div className="eta-box">
            ETA estimado (ajustado por reportes)
            <b>{routeData.eta_final} min</b>
            <span>
              Base: {routeData.eta_base} min · Ajuste: +
              {routeData.ajuste_reportes} min
            </span>
          </div>
        )}

        <RouteCard routeData={routeData} />

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder={'"Uninorte" o "Cra 51 #80-20, Barranquilla"'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            aria-label="Origen y destino"
          />
          <button type="submit" disabled={loading}>
            Enviar
          </button>
        </form>
      </aside>

      <div className="map-container">
        <MapContainer
          center={BARRANQUILLA_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <BusLayer onStatus={onBusStatus} />
          <GraphLayer
            grafo={routeData?.grafo}
            origen={routeData?.origen}
            destino={routeData?.destino}
          />
          {routeData && (
            <>
              <Marker position={[routeData.origen.lat, routeData.origen.lng]}>
                <Popup>Origen: {routeData.origen.nombre}</Popup>
              </Marker>
              <Marker position={[routeData.destino.lat, routeData.destino.lng]}>
                <Popup>Destino: {routeData.destino.nombre}</Popup>
              </Marker>
              <Polyline
                positions={routeData.ruta}
                pathOptions={{ color: '#2563eb', weight: 5 }}
              />
              <FitBounds bounds={bounds} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
