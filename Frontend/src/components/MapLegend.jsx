/**
 * Leyenda overlay /ruta.
 * Paleta acordada (GraphLayer nodos):
 * troncal stroke #ea580c · fill #f97316 (diamante) ·
 * barrio #64748b · poi stroke #0d9488 · fill #2dd4bf ·
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
