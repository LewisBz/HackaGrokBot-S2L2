import { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import BusLayer from '../components/BusLayer'
import RouteCard from '../components/RouteCard'
import GraphLayer from '../components/GraphLayer'
import MapLegend from '../components/MapLegend'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const BARRANQUILLA_CENTER = [10.9878, -74.7889]

const MIC_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function pickMicMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return ''
  }
  return MIC_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

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

/** POST multipart a Whisper. Field name: `audio` (el backend también puede aceptar `file`). */
async function callTranscribe(blob, mimeType) {
  const ext = mimeType.includes('ogg')
    ? 'ogg'
    : mimeType.includes('mp4') || mimeType.includes('m4a')
      ? 'm4a'
      : 'webm'
  const form = new FormData()
  form.append('audio', blob, `grabacion.${ext}`)

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    let detail = `No se pudo transcribir el audio (${res.status})`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (typeof body.error === 'string') detail = body.error
      else if (typeof body.message === 'string') detail = body.message
    } catch {
      /* keep */
    }
    throw new Error(detail)
  }
  const data = await res.json()
  const texto =
    (typeof data.texto === 'string' && data.texto) ||
    (typeof data.text === 'string' && data.text) ||
    (typeof data.transcription === 'string' && data.transcription) ||
    ''
  return texto.trim()
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
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [routeData, setRouteData] = useState(null)
  const [fullGrafo, setFullGrafo] = useState(null)
  const [grafoError, setGrafoError] = useState(null)
  const [busesOnline, setBusesOnline] = useState(null)
  const [busCount, setBusCount] = useState(0)
  const chatLogRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const chunksRef = useRef([])

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
        setFullGrafo(data)
        setGrafoError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setFullGrafo(null)
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
  }, [messages, loading, recording, transcribing])

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.state === 'recording' &&
          mediaRecorderRef.current.stop()
      } catch {
        /* ignore */
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
    }
  }, [])

  const sendTexto = useCallback(async (textoRaw) => {
    const texto = (textoRaw || '').trim()
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
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await sendTexto(input)
  }

  function stopTracks() {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
  }

  async function startRecording() {
    if (
      loading ||
      recording ||
      transcribing ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setMessages((prev) => [
          ...prev,
          {
            from: 'bot',
            text: 'Tu navegador no soporta grabación de audio. Escribe el origen y destino en el chat.',
          },
        ])
      }
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      chunksRef.current = []

      const mimeType = pickMicMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      }

      recorder.onstop = async () => {
        setRecording(false)
        const usedMime = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: usedMime })
        chunksRef.current = []
        stopTracks()
        mediaRecorderRef.current = null

        if (!blob.size) {
          setMessages((prev) => [
            ...prev,
            { from: 'bot', text: 'No se capturó audio. Intenta de nuevo.' },
          ])
          return
        }

        setTranscribing(true)
        try {
          const texto = await callTranscribe(blob, usedMime)
          if (!texto) {
            setMessages((prev) => [
              ...prev,
              {
                from: 'bot',
                text: 'No entendí el audio. Habla un poco más claro o escribe en el chat.',
              },
            ])
            return
          }
          setInput(texto)
          await sendTexto(texto)
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            {
              from: 'bot',
              text:
                'Error al transcribir: ' +
                (err.message || 'falló /api/transcribe'),
            },
          ])
          console.error(err)
        } finally {
          setTranscribing(false)
        }
      }

      recorder.start()
      setRecording(true)
    } catch (err) {
      stopTracks()
      mediaRecorderRef.current = null
      setRecording(false)
      const denied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        /permission|denied|NotAllowed/i.test(String(err?.message || err))
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: denied
            ? 'Permiso de micrófono denegado. Actívalo en el navegador o escribe el origen y destino.'
            : 'No se pudo acceder al micrófono: ' +
              (err.message || 'error desconocido'),
        },
      ])
      console.error(err)
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state === 'recording') {
      rec.stop()
    } else {
      setRecording(false)
      stopTracks()
    }
  }

  function toggleMic(e) {
    e.preventDefault()
    if (loading || transcribing) return
    if (recording) stopRecording()
    else startRecording()
  }

  const bounds = routeData?.ruta?.length
    ? routeData.ruta.map((p) => [p[0], p[1]])
    : null

  const micBusy = loading || transcribing
  const micLabel = recording
    ? 'Detener grabación'
    : transcribing
      ? 'Transcribiendo…'
      : 'Grabar con micrófono'

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
            {fullGrafo && !grafoError && (
              <span className="chip chip--ok">
                {(fullGrafo.nodos || []).length} nodos
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
          {recording && (
            <div className="msg bot" role="status">
              Grabando… Toca el micrófono otra vez para enviar.
            </div>
          )}
          {transcribing && (
            <div className="msg bot loading" role="status">
              Transcribiendo audio…
            </div>
          )}
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
            disabled={recording || transcribing}
          />
          <button
            type="button"
            className={`mic-btn${recording ? ' mic-btn--recording' : ''}`}
            onClick={toggleMic}
            disabled={micBusy && !recording}
            aria-pressed={recording}
            aria-label={micLabel}
            title={micLabel}
          >
            {recording ? '⏹' : '🎤'}
          </button>
          <button type="submit" disabled={loading || recording || transcribing}>
            Enviar
          </button>
        </form>
      </aside>

      <div className="map-container">
        <MapLegend />
        <MapContainer
          center={BARRANQUILLA_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GraphLayer grafo={fullGrafo} camino={routeData?.grafo || null} />
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
