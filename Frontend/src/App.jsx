import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const BACKEND_URL = '/api/ruta'
const COMENTARIOS_URL = '/api/comentarios'
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'false').toLowerCase() === 'true'
const BARRANQUILLA_CENTER = [10.9878, -74.7889]

const NAV = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'buscar', label: 'Buscar rutas', icon: '🗺️' },
  { id: 'comentarios', label: 'Comentarios', icon: '💬' },
]

const busIcon = L.divIcon({
  className: 'bus-marker',
  html: '<div class="bus-marker-inner">🚌</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

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

function rutaKeyFromData(data) {
  if (!data?.origen?.nombre || !data?.destino?.nombre) return 'general'
  return `${data.origen.nombre}→${data.destino.nombre}`
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
            Paradas clave: {(bus.paradas_clave || bus.paradas?.slice(0, 3) || []).join(' · ')}
          </div>
          <div className="motivo">{bus.motivo}</div>
        </article>
      ))}
    </div>
  )
}

function InicioView({ onGoBuscar, onGoComentarios }) {
  return (
    <div className="inicio-page">
      <section className="hero">
        <div className="hero-badge">Hackathon · Barranquilla</div>
        <h1>
          Ruta Bus <span>Barranquilla</span>
        </h1>
        <p className="hero-lead">
          Escribe a dónde vas en lenguaje natural. El bot entiende origen y destino, arma la ruta
          con OSRM, sugiere buses reales y te deja simular el viaje en el mapa.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn-primary" onClick={onGoBuscar}>
            Buscar una ruta
          </button>
          <button type="button" className="btn-ghost" onClick={onGoComentarios}>
            Ver comentarios
          </button>
        </div>
      </section>

      <section className="how">
        <h2>Cómo funciona</h2>
        <div className="how-grid">
          <article className="how-card">
            <div className="how-num">1</div>
            <h3>Escribe tu destino</h3>
            <p>Chat en español: “quiero ir del Centro a Soledad” o “Uninorte al Prado”.</p>
          </article>
          <article className="how-card">
            <div className="how-num">2</div>
            <h3>NLP + ruta + buses</h3>
            <p>Extraemos origen/destino, geocodificamos, pedimos OSRM y hacemos matching de líneas.</p>
          </article>
          <article className="how-card">
            <div className="how-num">3</div>
            <h3>Simula el viaje</h3>
            <p>Play / Pause: un bus animado recorre el mapa con ETA restante en vivo.</p>
          </article>
          <article className="how-card">
            <div className="how-num">4</div>
            <h3>Comenta la ruta</h3>
            <p>Deja tips en tiempo real (SSE) sobre el corredor o la línea que usaste.</p>
          </article>
        </div>
      </section>

      <section className="inicio-chips">
        <span>Sobusa</span>
        <span>Sodis</span>
        <span>Trasalianco</span>
        <span>La Carolina</span>
        <span>Montalvo</span>
      </section>
    </div>
  )
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return ''
  }
}

function ComentariosView({ initialFilter = '' }) {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState(initialFilter)
  const [autor, setAutor] = useState('Viajero BQ')
  const [texto, setTexto] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [rutaKey, setRutaKey] = useState(initialFilter || 'general')
  const [status, setStatus] = useState('conectando…')
  const [error, setError] = useState(null)
  const listRef = useRef(null)

  const load = useCallback(async (ruta) => {
    const q = ruta ? `?ruta=${encodeURIComponent(ruta)}` : ''
    const res = await fetch(`${COMENTARIOS_URL}${q}`)
    if (!res.ok) throw new Error('No se pudieron cargar comentarios')
    const data = await res.json()
    setItems(data.comentarios || [])
  }, [])

  useEffect(() => {
    setFilter(initialFilter)
    if (initialFilter) setRutaKey(initialFilter)
  }, [initialFilter])

  useEffect(() => {
    let cancelled = false
    let es = null
    let pollTimer = null

    async function boot() {
      try {
        await load(filter || undefined)
        if (cancelled) return
        setStatus('en vivo (SSE)')
        es = new EventSource(`${COMENTARIOS_URL}/stream`)
        es.addEventListener('comentario', (ev) => {
          try {
            const item = JSON.parse(ev.data)
            setItems((prev) => {
              if (prev.some((c) => c.id === item.id)) return prev
              const matches =
                !filter ||
                item.ruta_key.toLowerCase() === filter.toLowerCase() ||
                item.ruta_key.toLowerCase().includes(filter.toLowerCase())
              if (!matches) return prev
              return [item, ...prev]
            })
          } catch {
            /* ignore bad payload */
          }
        })
        es.onerror = () => {
          setStatus('reintentando… (poll 2s)')
          try {
            es.close()
          } catch {
            /* */
          }
          if (!pollTimer) {
            pollTimer = setInterval(() => {
              load(filter || undefined).catch(() => {})
            }, 2000)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setStatus('poll 2s')
          pollTimer = setInterval(() => {
            load(filter || undefined).catch(() => {})
          }, 2000)
        }
      }
    }

    boot()
    return () => {
      cancelled = true
      if (es) es.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [filter, load])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [items])

  async function handlePost(e) {
    e.preventDefault()
    setError(null)
    if (!texto.trim() || !autor.trim() || !rutaKey.trim()) return
    try {
      const res = await fetch(COMENTARIOS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autor: autor.trim(),
          texto: texto.trim(),
          ruta_key: rutaKey.trim(),
          empresa: empresa.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('No se pudo publicar')
      setTexto('')
      // Optimistic: SSE should deliver; refresh if filtered
      await load(filter || undefined)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="comentarios-page">
      <header className="section-head">
        <div>
          <h2>Comentarios de rutas</h2>
          <p className="muted">
            Tips en tiempo real de la comunidad · estado: <strong>{status}</strong>
          </p>
        </div>
        <div className="filter-row">
          <label>
            Filtrar por ruta
            <input
              type="text"
              placeholder="ej. Centro→Soledad"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <button type="button" className="btn-ghost sm" onClick={() => setFilter('')}>
            Todas
          </button>
        </div>
      </header>

      <div className="comentarios-layout">
        <div className="comentarios-feed" ref={listRef}>
          {items.length === 0 && (
            <div className="empty-feed">Aún no hay comentarios{filter ? ` para “${filter}”` : ''}.</div>
          )}
          {items.map((c) => (
            <article key={c.id} className="comment-card">
              <div className="comment-meta">
                <span className="comment-author">{c.autor}</span>
                <span className="comment-ruta">{c.ruta_key}</span>
                {c.empresa && <span className="comment-empresa">{c.empresa}</span>}
                <span className="comment-time">{formatTime(c.created_at)}</span>
              </div>
              <p>{c.texto}</p>
            </article>
          ))}
        </div>

        <form className="comment-form card" onSubmit={handlePost}>
          <h3>Publicar comentario</h3>
          <label>
            Tu nombre
            <input value={autor} onChange={(e) => setAutor(e.target.value)} required />
          </label>
          <label>
            Ruta (origen→destino o línea)
            <input
              value={rutaKey}
              onChange={(e) => setRutaKey(e.target.value)}
              placeholder="Centro→Soledad"
              required
            />
          </label>
          <label>
            Empresa (opcional)
            <input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Sobusa, Sodis…"
            />
          </label>
          <label>
            Comentario
            <textarea
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="¿Cómo estuvo el viaje? Tips de tráfico, paradas…"
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary">
            Enviar al feed en vivo
          </button>
        </form>
      </div>
    </div>
  )
}

function BuscarView({ routeData, setRouteData, onOpenComments }) {
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Hola, dime a dónde quieres ir. Ej: "quiero ir del Centro a Soledad"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
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
  const etaLeft = routeData ? Math.max(0, Math.ceil((routeData.eta_final || 0) * (1 - progress))) : 0
  const pct = Math.round(progress * 100)

  function handlePlay() {
    if (progress >= 1) setProgress(0)
    setPlaying(true)
  }

  return (
    <div className="buscar-page">
      <div className="panel">
        <header className="app-header">
          <span>Buscar rutas</span>
          <span className="header-sub">NLP · OSRM · buses · simulación</span>
        </header>

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
                Base: {routeData.eta_base} min · Ajuste: +{routeData.ajuste_reportes} min por reportes
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
                  <button type="button" className="sim-btn pause" onClick={() => setPlaying(false)}>
                    ⏸ Pausar
                  </button>
                )}
                <button
                  type="button"
                  className="sim-btn reset"
                  onClick={() => {
                    setPlaying(false)
                    setProgress(0)
                  }}
                >
                  ↺ Reiniciar
                </button>
              </div>
              <p className="sim-hint">Mira el bus animado sobre el mapa →</p>
            </div>

            <button
              type="button"
              className="btn-link-comments"
              onClick={() => onOpenComments(rutaKeyFromData(routeData))}
            >
              💬 Comentar esta ruta ({rutaKeyFromData(routeData)})
            </button>
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

export default function App() {
  const [page, setPage] = useState('inicio')
  const [routeData, setRouteData] = useState(null)
  const [commentFilter, setCommentFilter] = useState('')

  function openComments(rutaKey) {
    setCommentFilter(rutaKey || '')
    setPage('comentarios')
  }

  return (
    <div className="shell">
      <nav className="topnav">
        <div className="brand" onClick={() => setPage('inicio')} role="button" tabIndex={0}>
          <span className="brand-mark">🚌</span>
          <div>
            <strong>Ruta Bus BQ</strong>
            <small>HackaGrok · S2L2</small>
          </div>
        </div>
        <div className="nav-links">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`nav-link ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </div>
      </nav>

      <main className={`main main-${page}`}>
        {page === 'inicio' && (
          <InicioView onGoBuscar={() => setPage('buscar')} onGoComentarios={() => setPage('comentarios')} />
        )}
        {page === 'buscar' && (
          <BuscarView routeData={routeData} setRouteData={setRouteData} onOpenComments={openComments} />
        )}
        {page === 'comentarios' && <ComentariosView initialFilter={commentFilter} />}
      </main>
    </div>
  )
}
