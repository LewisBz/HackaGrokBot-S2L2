import { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const BACKEND_URL = import.meta.env.VITE_API_URL || '/api/ruta'
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK || 'false').toLowerCase() === 'true'

const BARRANQUILLA_CENTER = [10.9878, -74.7889]

const EXAMPLE_PROMPTS = [
  'quiero ir del Centro a Soledad',
  'de Uninorte al Prado',
  'de la Plaza de la Paz al Aeropuerto, sin pasar por el Mercado',
]

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function mockResponse(_texto) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        origen: { nombre: 'Uninorte', lat: 11.0198, lng: -74.8508 },
        destino: { nombre: 'Centro', lat: 10.9639, lng: -74.7964 },
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
        extract: { origen: 'Uninorte', destino: 'Centro', restriccion: null },
        _mock: true,
      })
    }, 900)
  })
}

async function callBackend(texto) {
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: texto }),
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const detail =
      (body && (body.detail || body.error)) ||
      `Error del backend: ${res.status}`
    const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    err.status = res.status
    err.body = body
    throw err
  }

  return body
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] })
  }, [bounds, map])
  return null
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: USE_MOCK
        ? 'Modo mock ON. Pide una ruta (texto o mic). Lugares NLP: Centro, Soledad, Uninorte, Prado, Aeropuerto…'
        : 'Conectado a /api/ruta (NLP → geocode/OSRM → reportes). Ej: "quiero ir del Centro a Soledad"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [routeData, setRouteData] = useState(null)
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState(null)
  const chatLogRef = useRef(null)
  const recognitionRef = useRef(null)
  const speechSupported = Boolean(getSpeechRecognition())

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const sendTexto = useCallback(
    async (texto) => {
      const trimmed = texto.trim()
      if (!trimmed || loading) return

      setMessages((prev) => [...prev, { from: 'user', text: trimmed }])
      setInput('')
      setLoading(true)
      setMicError(null)

      try {
        const data = USE_MOCK ? await mockResponse(trimmed) : await callBackend(trimmed)
        const extract = data.extract || {}
        const nlpLine =
          extract.origen || extract.destino
            ? `NLP: ${extract.origen || '?'} → ${extract.destino || '?'}` +
              (extract.restriccion ? ` (evitar: ${extract.restriccion})` : '')
            : null

        setMessages((prev) => [
          ...prev,
          ...(nlpLine ? [{ from: 'bot', text: nlpLine }] : []),
          {
            from: 'bot',
            text:
              `Ruta: ${data.origen.nombre} → ${data.destino.nombre}` +
              (data._mock ? ' (mock)' : ''),
          },
          ...(data.alerta ? [{ from: 'alert', text: data.alerta }] : []),
        ])
        setRouteData(data)
      } catch (err) {
        const hint =
          err.status === 422
            ? ' Indica origen y destino claros (ej. Centro, Soledad, Uninorte).'
            : !USE_MOCK
              ? ' ¿Backend arriba? `uvicorn app.main:app --reload --port 8000`'
              : ''
        setMessages((prev) => [
          ...prev,
          { from: 'bot', text: 'No pude armar la ruta: ' + err.message + hint },
        ])
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [loading],
  )

  function handleSubmit(e) {
    e.preventDefault()
    sendTexto(input)
  }

  function useExample(text) {
    setInput(text)
  }

  function toggleMic() {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setMicError('Tu navegador no soporta dictado por voz. Prueba Chrome o Edge.')
      return
    }

    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
      setListening(false)
      return
    }

    setMicError(null)
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-CO'
    recognition.interimResults = true
    recognition.continuous = false
    recognitionRef.current = recognition

    recognition.onstart = () => setListening(true)

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript.trim())
    }

    recognition.onerror = (event) => {
      setListening(false)
      if (event.error === 'not-allowed') {
        setMicError('Permiso de micrófono denegado. Actívalo en el navegador y reintenta.')
      } else if (event.error === 'no-speech') {
        setMicError('No escuché nada. Intenta de nuevo.')
      } else {
        setMicError('Error de voz: ' + event.error)
      }
    }

    recognition.onend = () => setListening(false)

    try {
      recognition.start()
    } catch (err) {
      setListening(false)
      setMicError('No pude iniciar el micrófono: ' + err.message)
    }
  }

  const bounds = routeData ? routeData.ruta.map((p) => [p[0], p[1]]) : null
  const extract = routeData?.extract

  return (
    <div className="app">
      <aside className="panel">
        <header className="app-header">
          <div className="app-title">🚌 Ruta Bus Barranquilla</div>
          <p className="app-sub">
            chat → NLP → /api/ruta → mapa · {USE_MOCK ? 'MOCK' : 'API live'}
          </p>
        </header>

        <div className="context-strip">
          <strong>Contexto</strong>
          <span>
            Flujo: mensaje → extract (origen/destino/restricción) → geocode/OSRM → reportes ETA.
          </span>
          <div className="chips-examples">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                type="button"
                className="chip"
                onClick={() => useExample(ex)}
                disabled={loading}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {routeData && (
          <div className="route-chips">
            <span className="chip-route origen">Origen: {routeData.origen.nombre}</span>
            <span className="chip-route destino">Destino: {routeData.destino.nombre}</span>
            {extract?.restriccion && (
              <span className="chip-route nlp">Evitar: {extract.restriccion}</span>
            )}
          </div>
        )}

        <div className="chat-log" ref={chatLogRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.from}`}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="msg bot loading">
              {USE_MOCK ? 'Mockeando ruta…' : 'NLP + ruta + reportes…'}
            </div>
          )}
        </div>

        {routeData && (
          <div className="eta-box">
            <div>ETA estimado (ajustado por reportes)</div>
            <b>{routeData.eta_final} min</b>
            <span>
              Base: {routeData.eta_base} min · Ajuste: +{routeData.ajuste_reportes} min
            </span>
            {extract && (
              <span className="eta-nlp">Extract NLP: {JSON.stringify(extract)}</span>
            )}
          </div>
        )}

        {micError && (
          <div className="mic-error" role="alert">
            {micError}
          </div>
        )}
        {listening && <div className="mic-listening">Escuchando… habla tu ruta</div>}

        <form className="chat-form" onSubmit={handleSubmit}>
          <button
            type="button"
            className={`mic-btn${listening ? ' active' : ''}`}
            onClick={toggleMic}
            disabled={loading || !speechSupported}
            aria-label={listening ? 'Detener micrófono' : 'Dictar con micrófono'}
            title={
              speechSupported
                ? listening
                  ? 'Detener'
                  : 'Dictar (es-CO)'
                : 'Voz no disponible en este navegador'
            }
          >
            {listening ? '⏹' : '🎤'}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: del Centro a Soledad…"
            autoComplete="off"
            disabled={loading}
            aria-label="Mensaje de ruta"
          />
          <button type="submit" disabled={loading || !input.trim()} aria-label="Enviar">
            Enviar
          </button>
        </form>
      </aside>

      <div className="map-container">
        {!routeData && (
          <div className="map-hint">
            Mapa Barranquilla. El backend resuelve NLP + OSRM al pedir una ruta.
          </div>
        )}
        <MapContainer center={BARRANQUILLA_CENTER} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {bounds && <FitBounds bounds={bounds} />}
          {routeData && (
            <>
              <Marker position={[routeData.origen.lat, routeData.origen.lng]}>
                <Popup>Origen: {routeData.origen.nombre}</Popup>
              </Marker>
              <Marker position={[routeData.destino.lat, routeData.destino.lng]}>
                <Popup>Destino: {routeData.destino.nombre}</Popup>
              </Marker>
              <Polyline positions={routeData.ruta} color="#2563eb" weight={5} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}
