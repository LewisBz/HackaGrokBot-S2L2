import { lineaColor } from '../utils/lineaColor'

export default function RouteCard({ routeData }) {
  if (!routeData) return null

  const bus = routeData.bus_recomendado
  const etaFallback = routeData.eta_final

  if (!bus) {
    return (
      <div className="route-card route-card--empty" role="status">
        <div className="route-card-title">Sin bus recomendado</div>
        <p className="route-card-body">
          Ningún bus cercano en flota. La ruta y el ETA del mapa siguen
          disponibles.
        </p>
        {etaFallback != null && (
          <div className="route-card-eta">~{etaFallback} min</div>
        )}
      </div>
    )
  }

  const color = lineaColor(bus.linea)
  const eta =
    bus.eta_min != null && bus.eta_min !== '' ? bus.eta_min : etaFallback
  const vieneDe = bus.viene_de || bus.origen_linea || '—'

  return (
    <div
      className="route-card"
      style={{
        borderColor: color.accent,
        boxShadow: `inset 4px 0 0 ${color.accent}`,
      }}
    >
      <div className="route-card-title">
        <span
          className="route-card-swatch"
          style={{ background: color.bg, borderColor: color.border }}
          aria-hidden
        />
        Bus recomendado
      </div>
      <div className="route-card-linea-row">
        <span className="route-card-linea" style={{ color: color.accent }}>
          {bus.linea}
        </span>
        <span className="route-card-gps">
          GPS <b>{bus.id}</b>
        </span>
      </div>
      <div className="route-card-meta">Viene de: {vieneDe}</div>
      <div className="route-card-eta">
        {eta != null ? `~${eta} min` : '—'}
      </div>
    </div>
  )
}
