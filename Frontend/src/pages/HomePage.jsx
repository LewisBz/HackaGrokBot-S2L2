import { Link } from 'react-router-dom'

const cards = [
  {
    title: 'Grafo de Barranquilla',
    body:
      'POIs clave (Uninorte, Centro, Soledad, Aeropuerto…) unidos por corredores urbanos. Dijkstra elige el camino más corto en minutos.',
    to: '/ruta',
    cta: 'Ver el mapa',
    icon: '🕸️',
  },
  {
    title: 'Encontrar ruta',
    body:
      'Escribe origen y destino en lenguaje natural. Geocodificamos, anclamos al POI más cercano y trazamos la polyline OSRM sobre calles reales.',
    to: '/ruta',
    cta: 'Probar el chat',
    icon: '🗺️',
  },
  {
    title: 'Comentarios por zona',
    body:
      'Comparte alertas de tráfico o servicio (Mercado, Centro, Vía 40…). El feed ayuda a ajustar la experiencia de otros viajeros.',
    to: '/comentarios',
    cta: 'Leer y publicar',
    icon: '💬',
  },
]

export default function HomePage() {
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">HackaGrok · Barranquilla</p>
        <h1>Muévete por la ciudad con un grafo real</h1>
        <p className="hero-lead">
          Explora el grafo de POIs y corredores, encuentra la mejor ruta con ETA
          ajustado por reportes, y comparte comentarios por zona.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/ruta">
            Encontrar ruta
          </Link>
          <Link className="btn btn-ghost" to="/comentarios">
            Ver comentarios
          </Link>
        </div>
      </section>

      <section className="card-grid" aria-label="Funciones">
        {cards.map((c) => (
          <article key={c.title} className="feature-card">
            <div className="feature-icon" aria-hidden>
              {c.icon}
            </div>
            <h2>{c.title}</h2>
            <p>{c.body}</p>
            <Link to={c.to} className="feature-link">
              {c.cta} →
            </Link>
          </article>
        ))}
      </section>
    </div>
  )
}
