import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ruta', label: 'Ruta' },
  { to: '/comentarios', label: 'Comentarios' },
]

export default function Nav() {
  return (
    <nav className="topnav" aria-label="Principal">
      <div className="topnav-brand">
        <span className="topnav-logo" aria-hidden>
          🚌
        </span>
        <div>
          <strong>Rutas Barranquilla</strong>
          <span className="topnav-sub">Grafo · OSRM · Comentarios</span>
        </div>
      </div>
      <ul className="topnav-links">
        {links.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink to={to} end={end}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
