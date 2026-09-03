import { useState, useRef, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix para los iconos de Leaflet en Vite (problema conocido)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ---------- CONFIG ----------
const BACKEND_URL = '/api/ruta'
const BUSES_URL = '/api/buses'
const USE_MOCK = false // pon en false cuando el backend esté listo

const BARRANQUILLA_CENTER = [10.9878, -74.7889]

function busIcon(linea) {
  const short = (linea || '?').split('-')[0]
  return L.divIcon({
    className: 'bus-marker',
    html: `<div class="bus-dot">${short}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// ---------- MOCK (para probar sin backend) ----------
function mockResponse(texto) {
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
        alerta: '⚠️ Reporte reciente: congestión fuerte en la Vía 40, altura del estadio.',
      })
    }, 900)
  })
}

// ---------- INTEGRACIÓN REAL ----------
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

// Ajusta el zoom del mapa cuando cambia la ruta
function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] })
  }, [bounds, map])
  return null
}

export default function App() {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Hola, dime a dónde quieres ir. Ej: "¿Cómo llego de la Universidad del Norte al Centro?"' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [routeData, setRouteData] = useState(null)
  const [buses, setBuses] = useState([])
  const chatLogRef = useRef(null)

  // Poll GPS de buses cada 1.5s
  useEffect(() => {
    let cancelled = false
    async function pull() {
      try {
        const res = await fetch(BUSES_URL)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) setBuses(data)
      } catch {
        /* ignore transient errors */
      }
    }
    pull()
    const id = setInterval(pull, 1500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
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
        { from: 'bot', text: `Ruta encontrada: ${data.origen.nombre} → ${data.destino.nombre}` },
        ...(data.alerta ? [{ from: 'alert', text: data.alerta }] : []),
      ])
      setRouteData(data)
    } catch (err) {
      setMessages((prev) => [...prev, { from: 'bot', text: 'Ups, algo falló: ' + err.message }])
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const bounds = routeData ? routeData.ruta.map((p) => [p[0], p[1]]) : null
  const busIcons = useMemo(() => {
    const map = {}
    for (const b of buses) {
      if (!map[b.linea]) map[b.linea] = busIcon(b.linea)
    }
    return map
  }, [buses])

  return (
    <div className="app">
      <div className="panel">
        <header className="app-header">🚌 Ruta Bus Barranquilla</header>

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
            ETA estimado (ajustado por reportes en tiempo real)
            <b>{routeData.eta_final} min</b>
            <span>
              Base: {routeData.eta_base} min · Ajuste: +{routeData.ajuste_reportes} min por reportes
            </span>
          </div>
        )}

        {routeData?.bus_recomendado && (
          <div className="bus-card">
            <div className="bus-card-title">🚌 Bus recomendado</div>
            <div>
              <b>{routeData.bus_recomendado.id}</b> · {routeData.bus_recomendado.linea}
            </div>
            <div className="bus-card-meta">
              Viene de: {routeData.bus_recomendado.viene_de}
              {routeData.bus_recomendado.hacia ? ` → ${routeData.bus_recomendado.hacia}` : ''}
            </div>
            <div className="bus-card-eta">ETA bus: ~{routeData.bus_recomendado.eta_min} min</div>
          </div>
        )}

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Escribe tu ruta..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
          />
          <button type="submit">Enviar</button>
        </form>
      </div>

      <div className="map-container">
        <MapContainer center={BARRANQUILLA_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {buses.map((b) => (
            <Marker
              key={b.id}
              position={[b.lat, b.lng]}
              icon={busIcons[b.linea] || busIcon(b.linea)}
            >
              <Popup>
                {b.id} · {b.linea}
                <br />
                {b.viene_de} → {b.hacia}
                <br />
                {b.speed_kmh} km/h
              </Popup>
            </Marker>
          ))}
          {routeData && (
            <>
              <Marker position={[routeData.origen.lat, routeData.origen.lng]}>
                <Popup>Origen: {routeData.origen.nombre}</Popup>
              </Marker>
              <Marker position={[routeData.destino.lat, routeData.destino.lng]}>
                <Popup>Destino: {routeData.destino.nombre}</Popup>
              </Marker>
              <Polyline positions={routeData.ruta} pathOptions={{ color: '#2563eb', weight: 5 }} />
              <FitBounds bounds={bounds} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
