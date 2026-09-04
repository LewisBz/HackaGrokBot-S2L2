import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ruta', label: 'Encontrar ruta' },
  { to: '/comentarios', label: 'Comentarios' },
]

export default function Layout() {
  return (
    <div className="site">
      <nav className="topnav" aria-label="Principal">
        <div className="topnav-brand">
          <span className="topnav-logo" aria-hidden>
            🚏
          </span>
          <div>
            <strong>Rutas Barranquilla</strong>
            <span className="topnav-sub">Grafo · OSRM · Comentarios</span>
          </div>
        </div>
        <ul className="topnav-links">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="site-main">
        <Outlet />
      </main>
    </div>
  )
}
