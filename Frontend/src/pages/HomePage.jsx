import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <main className="page page-home">
      <section className="hero">
        <p className="hero-kicker">Hackathon · Barranquilla</p>
        <h1>Navega la ciudad con un grafo real</h1>
        <p className="hero-lead">
          Rutas Barranquilla combina un grafo de nodos y aristas de la ciudad,
          búsqueda de caminos con Dijkstra, buses en vivo y comentarios por zona.
        </p>
        <div className="hero-ctas">
          <Link className="btn btn-primary" to="/ruta">
            Encontrar ruta
          </Link>
          <Link className="btn btn-ghost" to="/comentarios">
            Ver comentarios
          </Link>
        </div>
      </section>

      <section className="feature-grid" aria-label="Funciones">
        <article className="feature-card">
          <h2>Grafo de la ciudad</h2>
          <p>
            En la vista de ruta se dibuja siempre el grafo completo (nodos y
            aristas). Al pedir un trayecto, el camino Dijkstra se resalta sobre
            el mismo mapa.
          </p>
          <Link to="/ruta" className="feature-link">
            Ir al mapa →
          </Link>
        </article>

        <article className="feature-card">
          <h2>Encontrar ruta</h2>
          <p>
            Escribe origen y destino en lenguaje natural. El backend geocodifica,
            calcula el camino en el grafo y traza la polyline OSRM con ETA
            ajustado por reportes.
          </p>
          <Link to="/ruta" className="feature-link">
            Probar chat de rutas →
          </Link>
        </article>

        <article className="feature-card">
          <h2>Comentarios por zona</h2>
          <p>
            Comparte cómo está el tráfico o el servicio en tu barrio. El feed
            público ayuda a ajustar la experiencia de otros viajeros.
          </p>
          <Link to="/comentarios" className="feature-link">
            Leer y publicar →
          </Link>
        </article>
      </section>
    </main>
  )
}
