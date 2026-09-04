import { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import BusLayer from '../components/BusLayer'
import RouteCard from '../components/RouteCard'
import GraphLayer from '../components/GraphLayer'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const BARRANQUILLA_CENTER = [10.9878, -74.7889]

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds?.length) map.fitBounds(bounds, { padding: [48, 48] })
  }, [bounds, map])
  return null
}

async function callBackend(texto) {
  const res = await fetch('/api/ruta', {
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
      /* keep */
    }
    throw new Error(detail)
  }
  return res.json()
}

export default function RutaPage() {
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text:
        'Hola — dime origen y destino. Puedes usar nombres de lugares o direcciones. Ej: "Uninorte al Centro" o "Cra 51 #80-20 hasta el Prado".',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [routeData, setRouteData] = useState(null)
  const [grafo, setGrafo] = useState(null)
  const [grafoError, setGrafoError] = useState(null)
  const [busesOnline, setBusesOnline] = useState(null)
  const [busCount, setBusCount] = useState(0)
  const chatLogRef = useRef(null)

  const onBusStatus = useCallback(({ ok, count }) => {
    setBusesOnline(ok)
    setBusCount(count)
  }, [])

  useEffect(() => {
    let cancelled = false
    setGrafoError(null)
    fetch('/api/grafo')
      .then(async (r) => {
        if (!r.ok) throw new Error(`No se pudo cargar el grafo (${r.status})`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        if (!data || !Array.isArray(data.nodos)) {
          throw new Error('Respuesta de /api/grafo inválida')
        }
        setGrafo(data)
        setGrafoError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setGrafo(null)
        setGrafoError(err.message || 'Error al cargar /api/grafo')
      })
    return () => {
      cancelled = true
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
      const data = await callBackend(texto)
      const hops = (data.grafo?.nodos || []).map((n) => n.nombre || n.id).join(' → ')
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text:
            `Ruta encontrada: ${data.origen.nombre} → ${data.destino.nombre}` +
            (hops ? `\nCamino en grafo: ${hops}` : ''),
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

  const bounds = routeData?.ruta?.length
    ? routeData.ruta.map((p) => [p[0], p[1]])
    : null

  return (
    <div className="app route-page">
      <aside className="panel">
        <header className="app-header">
          <span className="app-header-title">Encontrar ruta</span>
          <div className="app-header-chips">
            {grafoError && (
              <span className="chip chip--warn" title={grafoError}>
                Grafo offline
              </span>
            )}
            {grafo && !grafoError && (
              <span className="chip chip--ok">
                {(grafo.nodos || []).length} nodos
              </span>
            )}
            {busesOnline === false && (
              <span className="chip chip--warn" title="No se pudo leer /api/buses">
                Buses offline
              </span>
            )}
            {busesOnline === true && (
              <span className="chip chip--ok">{busCount} en vivo</span>
            )}
          </div>
        </header>

        {grafoError && (
          <div className="banner-error" role="alert">
            {grafoError}. El mapa no inventará datos; reintenta cuando el API esté disponible.
          </div>
        )}

        <div className="chat-log" ref={chatLogRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.from}`}>
              {m.text}
            </div>
          ))}
          {loading && <div className="msg bot loading">Buscando ruta…</div>}
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
            placeholder={'"Uninorte al Centro" o dirección de calle'}
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
          <GraphLayer grafo={grafo} camino={routeData?.grafo || null} />
          <BusLayer onStatus={onBusStatus} />
          {routeData && (
            <>
              <Marker position={[routeData.origen.lat, routeData.origen.lng]}>
                <Popup>Origen: {routeData.origen.nombre}</Popup>
              </Marker>
              <Marker position={[routeData.destino.lat, routeData.destino.lng]}>
                <Popup>Destino: {routeData.destino.nombre}</Popup>
              </Marker>
              {Array.isArray(routeData.ruta) && routeData.ruta.length > 1 && (
                <Polyline
                  positions={routeData.ruta}
                  pathOptions={{ color: '#0ea5e9', weight: 5, opacity: 0.85 }}
                />
              )}
              {bounds && <FitBounds bounds={bounds} />}
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
