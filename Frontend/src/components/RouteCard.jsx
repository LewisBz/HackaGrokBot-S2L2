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
          No hay un bus cercano en flota para esta ruta (backend sin GPS /
          flota offline, o ningún vehículo a distancia útil). La ruta en el
          mapa y el ETA general siguen disponibles.
        </p>
        {etaFallback != null && (
          <div className="route-card-eta">ETA ruta: ~{etaFallback} min</div>
        )}
      </div>
    )
  }

  const color = lineaColor(bus.linea)
  const eta =
    bus.eta_min != null && bus.eta_min !== '' ? bus.eta_min : etaFallback

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
      <div className="route-card-linea" style={{ color: color.accent }}>
        {bus.linea}
      </div>
      <div className="route-card-meta">
        GPS <b>{bus.id}</b>
      </div>
      <div className="route-card-meta">
        Viene de: {bus.viene_de || '—'}
        {bus.hacia ? ` → ${bus.hacia}` : ''}
      </div>
      {bus.dist_km != null && (
        <div className="route-card-meta">Distancia: {bus.dist_km} km</div>
      )}
      <div className="route-card-eta">
        ETA: ~{eta != null ? `${eta} min` : '—'}
      </div>
    </div>
  )
}
