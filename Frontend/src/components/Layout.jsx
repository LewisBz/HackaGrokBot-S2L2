import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ruta', label: 'Encontrar ruta' },
  { to: '/comentarios', label: 'Comentarios' },
]

export default function Layout() {
  return (
    <div className="site">
      <nav className="site-nav" aria-label="Principal">
        <div className="site-nav-inner">
          <div className="site-nav-brand">
            <span aria-hidden>🚏</span>
            <div>
              <strong>Rutas Barranquilla</strong>
              <span className="topnav-sub">Grafo · OSRM · Comentarios</span>
            </div>
          </div>
          <ul className="site-nav-links">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    isActive ? 'site-nav-link is-active' : 'site-nav-link'
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <main className="site-main">
        <Outlet />
      </main>
    </div>
  )
}
