import { useMemo } from 'react'
import { CircleMarker, Marker, Polyline, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'

function nodeKey(n) {
  if (!n || typeof n !== 'object') return null
  const k = n.id ?? n.nombre
  return k == null || k === '' ? null : String(k)
}

function edgeEnds(e) {
  if (!e || typeof e !== 'object') return [null, null]
  const a = e.from ?? e.source
  const b = e.to ?? e.target
  return [
    a == null || a === '' ? null : String(a),
    b == null || b === '' ? null : String(b),
  ]
}

function buildLookup(nodos) {
  const byKey = new Map()
  for (const n of nodos || []) {
    const k = nodeKey(n)
    if (!k) continue
    const lat = Number(n.lat)
    const lng = Number(n.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    byKey.set(k, { ...n, _key: k, lat, lng })
  }
  return byKey
}

function pathIdSet(camino) {
  const ids = new Set()
  if (!camino || typeof camino !== 'object') return ids
  const nodos = Array.isArray(camino.nodos) ? camino.nodos : []
  const aristas = Array.isArray(camino.aristas) ? camino.aristas : []
  for (const n of nodos) {
    const k = nodeKey(n)
    if (k) ids.add(k)
  }
  for (const e of aristas) {
    const [a, b] = edgeEnds(e)
    if (a) ids.add(a)
    if (b) ids.add(b)
  }
  return ids
}

function pathEdgeSet(camino) {
  const edges = new Set()
  if (!camino || typeof camino !== 'object') return edges
  const aristas = Array.isArray(camino.aristas) ? camino.aristas : []
  for (const e of aristas) {
    const [a, b] = edgeEnds(e)
    if (a && b) {
      edges.add(`${a}|${b}`)
      edges.add(`${b}|${a}`)
    }
  }
  return edges
}

function fold(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Known Transmetro / troncal hubs when API has no tipo yet. */
const TRANSMETRO_HUBS = new Set(
  [
    'Plaza de la Paz',
    'Estación Plaza de la Paz',
    'Estacion Plaza de la Paz',
    'Portal de Barranquilla',
    'Estación Joe Arroyo',
    'Estacion Joe Arroyo',
  ].map(fold),
)

/**
 * Classify node as 'troncal' | 'barrio'.
 * Prefers API tipo|type|kind|categoria; falls back to name heuristics.
 */
function classifyNodeTipo(n) {
  const raw = n?.tipo ?? n?.type ?? n?.kind ?? n?.categoria
  if (raw != null && String(raw).trim() !== '') {
    const t = fold(String(raw).trim())
    if (
      t === 'troncal' ||
      t === 'transmetro' ||
      t === 'estacion' ||
      t === 'station'
    ) {
      return 'troncal'
    }
    if (t === 'barrio' || t === 'neighborhood' || t === 'poi') {
      return 'barrio'
    }
  }

  const name = String(n?.nombre ?? n?.id ?? n?._key ?? '')
  const lower = fold(name)
  if (TRANSMETRO_HUBS.has(lower)) return 'troncal'
  if (
    lower.includes('estacion') ||
    lower.includes('transmetro') ||
    lower.includes('troncal')
  ) {
    return 'troncal'
  }
  return 'barrio'
}

const STYLE_EDGE_BASE = {
  color: '#94a3b8',
  weight: 2,
  opacity: 0.4,
}

const STYLE_EDGE_PATH = {
  color: '#1d4ed8',
  weight: 6,
  opacity: 1,
}

const STYLE_BARRIO = {
  radius: 5,
  color: '#64748b',
  weight: 1,
  fillColor: '#94a3b8',
  fillOpacity: 0.75,
}

const STYLE_BARRIO_PATH = {
  radius: 9,
  color: '#1e3a8a',
  weight: 3,
  fillColor: '#2563eb',
  fillOpacity: 1,
}

const troncalIconCache = new Map()

function troncalIcon(onPath) {
  const key = onPath ? 'path' : 'base'
  let icon = troncalIconCache.get(key)
  if (icon) return icon
  const size = onPath ? 14 : 11
  const cls = onPath
    ? 'graph-node-diamond graph-node-diamond--path'
    : 'graph-node-diamond'
  icon = L.divIcon({
    className: 'graph-node-marker',
    html: `<span class="${cls}" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
  troncalIconCache.set(key, icon)
  return icon
}

const pathLabelIconCache = new Map()

function pathLabelIcon(nombre, tipo) {
  const key = `${tipo}|${nombre}`
  let icon = pathLabelIconCache.get(key)
  if (icon) return icon
  const safe = String(nombre)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const kind = tipo === 'troncal' ? 'troncal' : 'barrio'
  icon = L.divIcon({
    className: 'graph-path-label-wrap',
    html: `<span class="graph-path-label graph-path-label--${kind}">${safe}</span>`,
    iconSize: [0, 0],
    iconAnchor: [-10, 18],
  })
  pathLabelIconCache.set(key, icon)
  return icon
}

/**
 * Dibuja el grafo completo y resalta el camino Dijkstra.
 * Distingue troncal/Transmetro vs barrio; labels solo en camino (hover/click para el resto).
 * @param {{ nodos?: any[], aristas?: any[] } | null} grafo
 * @param {{ nodos?: any[], aristas?: any[] } | null} camino
 */
export default function GraphLayer({ grafo, camino }) {
  const model = useMemo(() => {
    if (!grafo || typeof grafo !== 'object') return null
    const nodos = Array.isArray(grafo.nodos) ? grafo.nodos : []
    const aristas = Array.isArray(grafo.aristas) ? grafo.aristas : []
    if (!nodos.length && !aristas.length) return null

    const byKey = buildLookup(nodos)
    if (camino?.nodos) {
      for (const n of camino.nodos) {
        const k = nodeKey(n)
        if (!k || byKey.has(k)) continue
        const lat = Number(n.lat)
        const lng = Number(n.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
        byKey.set(k, { ...n, _key: k, lat, lng })
      }
    }

    const highlightNodes = pathIdSet(camino)
    const highlightEdges = pathEdgeSet(camino)
    const hasPath = highlightNodes.size > 0 || highlightEdges.size > 0

    const edges = []
    for (let i = 0; i < aristas.length; i++) {
      const e = aristas[i]
      const [a, b] = edgeEnds(e)
      const na = a && byKey.get(a)
      const nb = b && byKey.get(b)
      if (!na || !nb) continue
      const onPath = hasPath && highlightEdges.has(`${a}|${b}`)
      edges.push({
        key: `e-${a}-${b}-${i}`,
        positions: [
          [na.lat, na.lng],
          [nb.lat, nb.lng],
        ],
        onPath,
      })
    }

    if (camino?.aristas) {
      for (let i = 0; i < camino.aristas.length; i++) {
        const e = camino.aristas[i]
        const [a, b] = edgeEnds(e)
        const na = a && byKey.get(a)
        const nb = b && byKey.get(b)
        if (!na || !nb) continue
        const already = edges.some(
          (x) =>
            (x.key.includes(`${a}-${b}`) || x.key.includes(`${b}-${a}`)) &&
            x.onPath,
        )
        if (already) continue
        const existsBase = edges.some(
          (x) =>
            x.key.startsWith(`e-${a}-${b}-`) || x.key.startsWith(`e-${b}-${a}-`),
        )
        if (existsBase) {
          for (const x of edges) {
            if (
              x.key.startsWith(`e-${a}-${b}-`) ||
              x.key.startsWith(`e-${b}-${a}-`)
            ) {
              x.onPath = true
            }
          }
        } else {
          edges.push({
            key: `e-path-${a}-${b}-${i}`,
            positions: [
              [na.lat, na.lng],
              [nb.lat, nb.lng],
            ],
            onPath: true,
          })
        }
      }
    }

    edges.sort((a, b) => Number(a.onPath) - Number(b.onPath))

    const nodes = [...byKey.values()].map((n) => {
      const tipo = classifyNodeTipo(n)
      const onPath = hasPath && highlightNodes.has(n._key)
      return {
        ...n,
        tipo,
        onPath,
        label: n.nombre || n.id || n._key,
      }
    })

    return { nodes, edges }
  }, [grafo, camino])

  if (!model) return null

  return (
    <>
      {model.edges.map((e) => (
        <Polyline
          key={e.key}
          positions={e.positions}
          pathOptions={e.onPath ? STYLE_EDGE_PATH : STYLE_EDGE_BASE}
        />
      ))}
      {model.nodes.map((n) => {
        const isTroncal = n.tipo === 'troncal'
        const tip = (
          <>
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              <span className="graph-node-tooltip">
                {n.label}
                {isTroncal ? (
                  <span className="graph-node-tooltip-kind"> · Troncal</span>
                ) : null}
              </span>
            </Tooltip>
            <Popup>
              <div className="graph-node-popup">
                <strong>{n.label}</strong>
                <div className="graph-node-popup-kind">
                  {isTroncal ? 'Troncal / Transmetro' : 'Barrio'}
                </div>
              </div>
            </Popup>
          </>
        )

        if (isTroncal) {
          return (
            <Marker
              key={`n-${n._key}`}
              position={[n.lat, n.lng]}
              icon={troncalIcon(n.onPath)}
              zIndexOffset={n.onPath ? 600 : 400}
            >
              {tip}
            </Marker>
          )
        }

        const opts = n.onPath ? STYLE_BARRIO_PATH : STYLE_BARRIO
        return (
          <CircleMarker
            key={`n-${n._key}`}
            center={[n.lat, n.lng]}
            pathOptions={opts}
            radius={opts.radius}
            className="graph-node graph-node--barrio"
          >
            {tip}
          </CircleMarker>
        )
      })}
      {model.nodes
        .filter((n) => n.onPath)
        .map((n) => (
          <Marker
            key={`lbl-${n._key}`}
            position={[n.lat, n.lng]}
            icon={pathLabelIcon(n.label, n.tipo)}
            interactive={false}
            keyboard={false}
            zIndexOffset={700}
          />
        ))}
    </>
  )
}
