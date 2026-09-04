/**
 * Leyenda overlay /ruta.
 * Paleta acordada: troncal #e11d48 · barrio #0d9488 · poi #64748b ·
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
