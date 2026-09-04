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

export default function ComentariosPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [zona, setZona] = useState('')
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async (opts = {}) => {
    const silent = !!opts.silent
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch('/api/comentarios')
      if (!res.ok) throw new Error(`Error ${res.status} al cargar comentarios`)
      const data = await res.json()
      setItems(normalizeList(data))
      if (silent) setError(null)
    } catch (err) {
      if (!silent) {
        setError(err.message || 'No se pudieron cargar los comentarios')
        setItems([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load({ silent: true }), 3000)
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
      setZona('')
      setTexto('')
      await load()
    } catch (err) {
      setFormError(err.message || 'No se pudo publicar')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="page page-comentarios">
      <header className="page-header">
        <h1>Comentarios</h1>
        <p>Comparte cómo se mueve tu zona en Barranquilla.</p>
      </header>

      <form className="comentarios-form" onSubmit={handleSubmit}>
        <label>
          Zona
          <input
            type="text"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            placeholder="Ej: Prado, Centro, Vía 40…"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Comentario
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Tráfico, buses, demoras…?"
            rows={3}
            maxLength={500}
            required
          />
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? 'Publicando…' : 'Publicar'}
        </button>
      </form>

      <section className="comentarios-feed" aria-live="polite">
        <div className="feed-toolbar">
          <h2>Feed</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            Actualizar
          </button>
        </div>

        {loading && <p className="muted">Cargando comentarios…</p>}
        {error && !loading && (
          <p className="chip chip--warn" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="muted">Aún no hay comentarios. Sé el primero.</p>
        )}
        <ul className="comentarios-list">
          {items.map((c, i) => (
            <li key={c.id ?? `${c.zona}-${i}`} className="comentario-card">
              <div className="comentario-zona">{c.zona || 'Sin zona'}</div>
              <p className="comentario-texto">{c.texto || c.mensaje || ''}</p>
              {(c.created_at || c.fecha) && (
                <time className="comentario-fecha" dateTime={c.created_at || c.fecha}>
                  {formatTime(c.created_at || c.fecha)}
                </time>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
