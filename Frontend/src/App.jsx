import { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix iconos Leaflet en Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ---------- CONFIG ----------
const BACKEND_URL = 'http://localhost:8000/api/ruta'
const USE_MOCK = true // false cuando el backend de Peñata esté listo

const BARRANQUILLA_CENTER = [10.9878, -74.7889]

const EXAMPLE_PROMPTS = [
  '¿Cómo llego de la Universidad del Norte al Centro?',
  'Ruta de Soledad al Prado',
  'De la Universidad Libre al aeropuerto',
]

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

// ---------- MOCK ----------
function mockResponse(_texto) {
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
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] })
  }, [bounds, map])
  return null
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Hola. Pregúntame una ruta en Barranquilla por texto o con el micrófono. Ej: "¿Cómo llego de la Universidad del Norte al Centro?"',
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

  const sendTexto = useCallback(async (texto) => {
    const trimmed = texto.trim()
    if (!trimmed || loading) return

    setMessages((prev) => [...prev, { from: 'user', text: trimmed }])
    setInput('')
    setLoading(true)
    setMicError(null)

    try {
      const data = USE_MOCK ? await mockResponse(trimmed) : await callBackend(trimmed)
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
  }, [loading])

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

      const last = event.results[event.results.length - 1]
      if (last?.isFinal) {
        const finalText = transcript.trim()
        if (finalText) {
          // Deja el texto en el input; el usuario confirma con Enviar (más seguro en demo)
          setInput(finalText)
        }
      }
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

  return (
    <div className="app">
      <aside className="panel">
        <header className="app-header">
          <div className="app-title">🚌 Ruta Bus Barranquilla</div>
          <p className="app-sub">Demo hackathon · chat → ruta en mapa · ETA con reportes</p>
        </header>

        <div className="context-strip">
          <strong>Contexto</strong>
          <span>Rutas de bus en Barranquilla. Escribe o dicta origen y destino.</span>
          <div className="chips-examples">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => useExample(ex)} disabled={loading}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {routeData && (
          <div className="route-chips">
            <span className="chip-route origen">Origen: {routeData.origen.nombre}</span>
            <span className="chip-route destino">Destino: {routeData.destino.nombre}</span>
          </div>
        )}

        <div className="chat-log" ref={chatLogRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.from}`}>
              {m.text}
            </div>
          ))}
          {loading && <div className="msg bot loading">Buscando ruta…</div>}
        </div>

        {routeData && (
          <div className="eta-box">
            <div>ETA estimado (ajustado por reportes)</div>
            <b>{routeData.eta_final} min</b>
            <span>
              Base: {routeData.eta_base} min · Ajuste: +{routeData.ajuste_reportes} min por reportes
            </span>
          </div>
        )}

        {micError && <div className="mic-error" role="alert">{micError}</div>}
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
            placeholder="Origen y destino…"
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
          <div className="map-hint">Mapa centrado en Barranquilla. Pide una ruta para ver el trayecto.</div>
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
