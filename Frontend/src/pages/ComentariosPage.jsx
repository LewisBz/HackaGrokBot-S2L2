import { useCallback, useEffect, useState } from 'react'

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return String(iso)
  }
}

function normalizeList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.comentarios)) return data.comentarios
  return []
}

const ZONAS_FALLBACK = [
  'Centro',
  'Prado',
  'Vía 40',
  'Uninorte',
  'Soledad',
  'Mercado',
  'Aeropuerto',
  'Otro',
]

const POLL_MS = 4500

export default function ComentariosPage() {
  const [items, setItems] = useState([])
  const [zonas, setZonas] = useState(ZONAS_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [softError, setSoftError] = useState(null)
  const [zona, setZona] = useState('Centro')
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch('/api/comentarios')
      if (!res.ok) throw new Error(`Error ${res.status} al cargar comentarios`)
      const data = await res.json()
      setItems(normalizeList(data))
      if (Array.isArray(data?.zonas) && data.zonas.length) {
        setZonas(data.zonas)
        setZona((z) => (data.zonas.includes(z) ? z : data.zonas[0]))
      }
      setSoftError(null)
      if (!silent) setError(null)
    } catch (err) {
      const msg = err.message || 'No se pudieron cargar los comentarios'
      if (silent) {
        // Keep last items; soft notice only (no spinner / hard flash)
        setSoftError(msg)
      } else {
        setError(msg)
        setItems([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load({ silent: false })
    const id = setInterval(() => {
      load({ silent: true })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    const z = zona.trim()
    const t = texto.trim()
    if (!z || !t) {
      setFormError('Zona y texto son obligatorios')
      return
    }
    setSending(true)
    setFormError(null)
    try {
      const res = await fetch('/api/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zona: z, texto: t }),
      })
      if (!res.ok) {
        let detail = `Error ${res.status}`
        try {
          const body = await res.json()
          if (typeof body.detail === 'string') detail = body.detail
        } catch {
          /* keep */
        }
        throw new Error(detail)
      }
      setTexto('')
      await load({ silent: false })
    } catch (err) {
      setFormError(err.message || 'No se pudo publicar')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="comentarios-page">
      <header className="page-header">
        <h1>Comentarios en vivo</h1>
        <p>Comparte alertas por zona en Barranquilla. Sin mocks: todo va al API.</p>
      </header>

      <form className="comentario-form" onSubmit={handleSubmit}>
        <label>
          Zona
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            {zonas.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          Comentario
          <input
            type="text"
            maxLength={500}
            placeholder="Ej: Tráfico lento en la Calle 72…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? 'Publicando…' : 'Publicar'}
        </button>
      </form>
      {formError && <p className="form-error">{formError}</p>}

      <div className="feed-toolbar">
        <h2>Feed</h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => load({ silent: false })}
          disabled={loading}
        >
          Actualizar
        </button>
      </div>

      {loading && <p className="muted">Cargando comentarios…</p>}
      {error && !loading && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {softError && !error && !loading && (
        <p className="muted" role="status">
          No se pudo actualizar ahora. Mostrando lo último cargado.
        </p>
      )}

      <ul className="comentario-list">
        {!loading && !error && items.length === 0 && (
          <li className="comentario-empty">Aún no hay comentarios. Sé el primero.</li>
        )}
        {items.map((c, i) => (
          <li key={c.id ?? `${c.zona}-${i}`} className="comentario-item">
            <span className="zone-tag">{c.zona || 'Sin zona'}</span>
            <p>{c.texto || c.mensaje || ''}</p>
            {(c.created_at || c.fecha) && (
              <time dateTime={c.created_at || c.fecha}>
                {formatTime(c.created_at || c.fecha)}
              </time>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
