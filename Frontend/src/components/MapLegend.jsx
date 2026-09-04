/**
 * Leyenda overlay /ruta.
 * Paleta GraphLayer 1:1: troncal fill #f97316 / stroke #ea580c (diamante) ·
 * barrio stroke #64748b / fill #94a3b8 · poi fill #2dd4bf / stroke #0d9488 ·
 * camino #2563eb · OSRM #0ea5e9
 */
export default function MapLegend() {
  return (
    <aside className="map-legend" aria-label="Leyenda del mapa">
      <p className="map-legend-title">Leyenda</p>
      <ul className="map-legend-list">
        <li>
          <span className="map-legend-swatch map-legend-swatch--troncal" aria-hidden />
          <span>Troncal Transmetro</span>
        </li>
        <li>
          <span className="map-legend-swatch map-legend-swatch--barrio" aria-hidden />
          <span>Barrio</span>
        </li>
        <li>
          <span className="map-legend-swatch map-legend-swatch--poi" aria-hidden />
          <span>POI</span>
        </li>
        <li>
          <span className="map-legend-swatch map-legend-swatch--path" aria-hidden />
          <span>Camino resaltado</span>
        </li>
        <li>
          <span className="map-legend-swatch map-legend-swatch--osrm" aria-hidden />
          <span>Ruta OSRM</span>
        </li>
      </ul>
    </aside>
  )
}
