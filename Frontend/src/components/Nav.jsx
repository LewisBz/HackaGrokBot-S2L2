import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ruta', label: 'Ruta' },
  { to: '/comentarios', label: 'Comentarios' },
]

export default function Nav() {
  return (
    <nav className="site-nav" aria-label="Principal">
      <div className="site-nav-inner">
        <NavLink to="/" end className="site-nav-brand">
          🚌 Rutas Barranquilla
        </NavLink>
        <ul className="site-nav-links">
          {links.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? 'site-nav-link is-active' : 'site-nav-link'
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
