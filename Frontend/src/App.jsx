import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
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
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'false').toLowerCase() === 'true'

const BARRANQUILLA_CENTER = [10.9878, -74.7889]

const busIcon = L.divIcon({
  className: 'bus-marker',
  html: '<div class="bus-marker-inner">🚌</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

// ---------- MOCK (para probar sin backend) ----------
function mockResponse(_texto) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        origen: { nombre: 'Centro', lat: 10.9639, lng: -74.7964 },
        destino: { nombre: 'Soledad', lat: 10.918, lng: -74.767 },
        ruta: [
          [10.9639, -74.7964],
          [10.95, -74.79],
          [10.935, -74.78],
          [10.918, -74.767],
        ],
        eta_base: 25,
        ajuste_reportes: 5,
        eta_final: 30,
        alerta: '⚠️ Tráfico moderado en Centro (+5 min)',
        transporte: [
          {
            empresa: 'Sobusa',
            codigo: 'C13',
            nombre: 'Vía 40 / Calle 76 → Nevada Soledad',
            paradas: ['Uninorte', 'Riomar', 'Prado', 'Plaza de la Paz', 'Centro', 'Mercado', 'Soledad'],
            paradas_clave: ['Uninorte', 'Centro', 'Soledad'],
            color: '#E11D48',
            motivo: 'Cubre Centro y Soledad en el mismo sentido (2 tramo(s)).',
            score: 92,
            demo_inventado: false,
          },
          {
            empresa: 'Sodis',
            codigo: 'B15',
            nombre: 'Soledad · Calle 17 · Centro · La Paz',
            paradas: ['Soledad', 'Mercado', 'Centro', 'Plaza de la Paz', 'Boston'],
            paradas_clave: ['Soledad', 'Centro', 'Boston'],
            color: '#A78BFA',
            motivo: 'Cubre Centro y Soledad (sentido inverso, 2 tramo(s)).',
            score: 88,
            demo_inventado: false,
          },
        ],
      })
    }, 700)
  })
}

async function callBackend(texto) {
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: texto }),
  })
  if (!res.ok) throw new Error('Error del backend: ' + res.status)
  return res.json()
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length) map.fitBounds(bounds, { padding: [48, 48] })
  }, [bounds, map])
  return null
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function interpolateAlong(path, t) {
  if (!path || path.length === 0) return null
  if (path.length === 1) return path[0]
  const clamped = Math.max(0, Math.min(1, t))
  const segCount = path.length - 1
  const exact = clamped * segCount
  const i = Math.min(Math.floor(exact), segCount - 1)
  const local = exact - i
  const a = path[i]
  const b = path[i + 1]
  return [lerp(a[0], b[0], local), lerp(a[1], b[1], local)]
}

function JourneySim({ routeData, playing, progress, onProgress }) {
  const path = routeData?.ruta || []
  const pos = useMemo(() => interpolateAlong(path, progress), [path, progress])
  const rafRef = useRef(null)
  const lastRef = useRef(null)

  useEffect(() => {
    if (!playing || !path.length) return undefined

    const durationMs = Math.max(8000, (routeData.eta_final || 20) * 180)

    const tick = (now) => {
      if (lastRef.current == null) lastRef.current = now
      const dt = now - lastRef.current
      lastRef.current = now
      onProgress((prev) => {
        const next = prev + dt / durationMs
        if (next >= 1) return 1
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = null
    }
  }, [playing, path.length, routeData?.eta_final, onProgress])

  useEffect(() => {
    if (progress >= 1 && playing) {
      onProgress(1)
    }
  }, [progress, playing, onProgress])

  if (!pos) return null
  return (
    <Marker position={pos} icon={busIcon}>
      <Popup>Simulación en vivo · {Math.round(progress * 100)}%</Popup>
    </Marker>
  )
}

function TransitCards({ items }) {
  if (!items?.length) {
    return (
      <div className="transit-empty">
        No hay líneas curadas para este corredor. Prueba Centro → Soledad o Uninorte → Centro.
      </div>
    )
  }
  return (
    <div className="transit-list">
      <div className="transit-title">🚌 Buses sugeridos</div>
      {items.map((bus) => (
        <article key={`${bus.empresa}-${bus.codigo}`} className="transit-card">
          <div className="transit-card-head">
            <span className="empresa-badge" style={{ background: bus.color || '#64748B' }}>
              {bus.empresa}
              {bus.demo_inventado ? ' · demo' : ''}
            </span>
            <span className="ruta-code">{bus.codigo}</span>
          </div>
          <div className="ruta-name">{bus.nombre}</div>
          <div className="paradas-key">
            Paradas clave:{' '}
            {(bus.paradas_clave || bus.paradas?.slice(0, 3) || []).join(' · ')}
          </div>
          <div className="motivo">{bus.motivo}</div>
        </article>
      ))}
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Hola, dime a dónde quieres ir. Ej: "quiero ir del Centro a Soledad"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [routeData, setRouteData] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const chatLogRef = useRef(null)

  const setProgressSafe = useCallback((updater) => {
    setProgress((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next >= 1) {
        setPlaying(false)
        return 1
      }
      return next
    })
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
    setPlaying(false)
    setProgress(0)

    try {
      const data = USE_MOCK ? await mockResponse(texto) : await callBackend(texto)

      const nBuses = data.transporte?.length || 0
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: `Ruta encontrada: ${data.origen.nombre} → ${data.destino.nombre}${
            nBuses ? ` · ${nBuses} bus(es) sugerido(s)` : ''
          }`,
        },
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
  const etaLeft = routeData
    ? Math.max(0, Math.ceil((routeData.eta_final || 0) * (1 - progress)))
    : 0
  const pct = Math.round(progress * 100)

  function handlePlay() {
    if (progress >= 1) setProgress(0)
    setPlaying(true)
  }

  function handlePause() {
    setPlaying(false)
  }

  function handleReset() {
    setPlaying(false)
    setProgress(0)
  }

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
          {loading && <div className="msg bot loading">Buscando ruta y buses...</div>}
        </div>

        {routeData && (
          <>
            <div className="eta-box">
              ETA estimado (ajustado por reportes en tiempo real)
              <b>{routeData.eta_final} min</b>
              <span>
                Base: {routeData.eta_base} min · Ajuste: +{routeData.ajuste_reportes} min por
                reportes
              </span>
            </div>

            <TransitCards items={routeData.transporte} />

            <div className="sim-panel">
              <div className="sim-title">🎬 Simulación del viaje</div>
              <div className="sim-stats">
                <span>
                  Progreso <strong>{pct}%</strong>
                </span>
                <span>
                  ETA restante <strong>{etaLeft} min</strong>
                </span>
              </div>
              <div className="sim-bar">
                <div className="sim-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="sim-controls">
                {!playing ? (
                  <button type="button" className="sim-btn play" onClick={handlePlay}>
                    ▶ Play
                  </button>
                ) : (
                  <button type="button" className="sim-btn pause" onClick={handlePause}>
                    ⏸ Pausar
                  </button>
                )}
                <button type="button" className="sim-btn reset" onClick={handleReset}>
                  ↺ Reiniciar
                </button>
              </div>
              <p className="sim-hint">Mira el bus animado sobre el mapa →</p>
            </div>
          </>
        )}

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder='Ej: "quiero ir del Centro a Soledad"'
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
                pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.85 }}
              />
              <JourneySim
                routeData={routeData}
                playing={playing}
                progress={progress}
                onProgress={setProgressSafe}
              />
              <FitBounds bounds={bounds} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
