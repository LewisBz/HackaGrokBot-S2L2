import { Link } from 'react-router-dom'

const cards = [
  {
    title: 'Grafo urbano',
    body:
      'Nodos y corredores de Barranquilla: troncales Transmetro (Murillo, Olaya Herrera…) junto a barrios y POIs. El camino más corto se calcula sobre ese grafo.',
    to: '/ruta',
    cta: 'Abrir el mapa',
    icon: '🕸️',
    tone: 'troncal',
  },
  {
    title: 'Encontrar ruta',
    body:
      'Di origen y destino en lenguaje natural. Anclamos al grafo, resaltamos el camino y dibujamos la polyline OSRM sobre calles reales.',
    to: '/ruta',
    cta: 'Probar el chat',
    icon: '🗺️',
    tone: 'ruta',
  },
  {
    title: 'Comentarios por zona',
    body:
      'Publica alertas de tráfico o servicio cerca de troncales y barrios. El feed ayuda a ajustar la experiencia de otros viajeros.',
    to: '/comentarios',
    cta: 'Leer y publicar',
    icon: '💬',
    tone: 'comentarios',
  },
]

export default function HomePage() {
  return (
    <div className="home">
      <section className="hero hero--strong">
        <p className="eyebrow">HackaGrok · Barranquilla</p>
        <h1>
          Rutas claras sobre el{' '}
          <span className="hero-accent">grafo</span> de la ciudad
        </h1>
        <p className="hero-lead">
          Visualiza troncales Transmetro, barrios y POIs en un solo mapa,
          encuentra el mejor camino con ETA ajustado por reportes, y comparte lo
          que pasa en tu zona — sin inventar datos: todo sale del grafo y del API.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary btn-lg" to="/ruta">
            Encontrar ruta
          </Link>
          <Link className="btn btn-secondary btn-lg" to="/ruta">
            Ver grafo en el mapa
          </Link>
          <Link className="btn btn-ghost btn-lg" to="/comentarios">
            Comentarios
          </Link>
        </div>
        <ul className="hero-pills" aria-label="Qué verás en el mapa">
          <li>
            <span className="pill-dot pill-dot--troncal" aria-hidden />
            Troncales Transmetro
          </li>
          <li>
            <span className="pill-dot pill-dot--barrio" aria-hidden />
            Barrios
          </li>
          <li>
            <span className="pill-dot pill-dot--poi" aria-hidden />
            POIs
          </li>
          <li>
            <span className="pill-dot pill-dot--path" aria-hidden />
            Camino en grafo
          </li>
          <li>
            <span className="pill-dot pill-dot--osrm" aria-hidden />
            Ruta OSRM
          </li>
        </ul>
      </section>

      <section className="home-strip" aria-label="Cómo funciona">
        <div className="home-strip-item">
          <strong>1. Grafo</strong>
          <span>Troncales, barrios y POIs como nodos conectados</span>
        </div>
        <div className="home-strip-item">
          <strong>2. Camino</strong>
          <span>Se resalta el recorrido óptimo entre nodos</span>
        </div>
        <div className="home-strip-item">
          <strong>3. Calles</strong>
          <span>OSRM traza la polyline sobre la vía real</span>
        </div>
      </section>

      <section className="card-grid" aria-label="Funciones">
        {cards.map((c) => (
          <article key={c.title} className={`feature-card feature-card--${c.tone}`}>
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
