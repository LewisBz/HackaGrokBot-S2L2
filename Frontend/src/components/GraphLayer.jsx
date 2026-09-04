import { useMemo } from 'react'
import { CircleMarker, Polyline, Popup } from 'react-leaflet'

/** Resolve node identity (id or nombre). */
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

function normName(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Decide which node ids are on the highlighted path.
 * Prefer explicit camino / flags; fall back to origen/destino name match
 * or "grafo is already a path" (n-1 edges forming a chain).
 */
function resolvePathIds(grafo, origen, destino) {
  const nodos = Array.isArray(grafo?.nodos) ? grafo.nodos : []
  const aristas = Array.isArray(grafo?.aristas) ? grafo.aristas : []
  const byKey = new Map()
  for (const n of nodos) {
    const k = nodeKey(n)
    if (k) byKey.set(k, n)
  }

  // Explicit camino / path arrays on grafo or top-level-like fields
  const camino =
    grafo.camino ||
    grafo.path ||
    grafo.ruta_nodos ||
    grafo.nodos_camino ||
    null
  if (Array.isArray(camino) && camino.length) {
    return new Set(camino.map((x) => String(x)))
  }

  // Per-node flags
  const flagged = nodos
    .filter(
      (n) =>
        n.en_camino === true ||
        n.on_path === true ||
        n.highlight === true ||
        n.en_ruta === true,
    )
    .map(nodeKey)
    .filter(Boolean)
  if (flagged.length) return new Set(flagged)

  // Edges flagged as path
  const edgePathKeys = new Set()
  let anyEdgeFlag = false
  for (const e of aristas) {
    if (e.en_camino || e.on_path || e.highlight || e.en_ruta) {
      anyEdgeFlag = true
      const [a, b] = edgeEnds(e)
      if (a) edgePathKeys.add(a)
      if (b) edgePathKeys.add(b)
    }
  }
  if (anyEdgeFlag) return edgePathKeys

  // Grafo looks like a single path (path_as_grafo style)
  if (nodos.length >= 2 && aristas.length === nodos.length - 1) {
    const deg = new Map()
    let ok = true
    for (const e of aristas) {
      const [a, b] = edgeEnds(e)
      if (!a || !b || !byKey.has(a) || !byKey.has(b)) {
        ok = false
        break
      }
      deg.set(a, (deg.get(a) || 0) + 1)
      deg.set(b, (deg.get(b) || 0) + 1)
    }
    if (ok) {
      const degrees = [...deg.values()]
      const ends = degrees.filter((d) => d === 1).length
      const middles = degrees.filter((d) => d === 2).length
      if (ends === 2 && middles === Math.max(0, nodos.length - 2)) {
        return new Set(byKey.keys())
      }
    }
  }

  // Match origen / destino names to nodes
  const oName = normName(origen?.nombre ?? origen?.id ?? origen)
  const dName = normName(destino?.nombre ?? destino?.id ?? destino)
  const matched = new Set()
  if (oName || dName) {
    for (const [k, n] of byKey) {
      const nk = normName(k)
      const nn = normName(n.nombre)
      if ((oName && (nk === oName || nn === oName)) || (dName && (nk === dName || nn === dName))) {
        matched.add(k)
      }
    }
  }
  return matched
}

const STYLE_EDGE_SUBTLE = {
  color: '#64748b',
  weight: 2,
  opacity: 0.45,
  dashArray: '4 6',
}
const STYLE_EDGE_PATH = {
  color: '#c026d3',
  weight: 4,
  opacity: 0.9,
}
const STYLE_NODE_SUBTLE = {
  radius: 5,
  color: '#475569',
  weight: 1,
  fillColor: '#94a3b8',
  fillOpacity: 0.55,
}
const STYLE_NODE_PATH = {
  radius: 7,
  color: '#86198f',
  weight: 2,
  fillColor: '#e879f9',
  fillOpacity: 0.9,
}

/**
 * Draws routeData.grafo on the Leaflet map.
 * If grafo is missing/null, renders nothing (no mocks).
 */
export default function GraphLayer({ grafo, origen, destino }) {
  const model = useMemo(() => {
    if (!grafo || typeof grafo !== 'object') return null
    const nodos = Array.isArray(grafo.nodos) ? grafo.nodos : []
    const aristas = Array.isArray(grafo.aristas) ? grafo.aristas : []
    if (!nodos.length && !aristas.length) return null

    const byKey = new Map()
    for (const n of nodos) {
      const k = nodeKey(n)
      if (!k) continue
      const lat = Number(n.lat)
      const lng = Number(n.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      byKey.set(k, { ...n, _key: k, lat, lng })
    }

    const pathIds = resolvePathIds(grafo, origen, destino)
    const hasPathHighlight = pathIds.size > 0

    const edges = []
    for (let i = 0; i < aristas.length; i++) {
      const e = aristas[i]
      const [a, b] = edgeEnds(e)
      const na = a && byKey.get(a)
      const nb = b && byKey.get(b)
      if (!na || !nb) continue
      const onPath =
        hasPathHighlight && pathIds.has(a) && pathIds.has(b)
          ? true
          : !!(e.en_camino || e.on_path || e.highlight || e.en_ruta)
      edges.push({
        key: `e-${a}-${b}-${i}`,
        positions: [
          [na.lat, na.lng],
          [nb.lat, nb.lng],
        ],
        onPath,
      })
    }

    const nodes = [...byKey.values()].map((n) => ({
      ...n,
      onPath: hasPathHighlight && pathIds.has(n._key),
    }))

    return { nodes, edges, hasPathHighlight }
  }, [grafo, origen, destino])

  if (!model) return null

  return (
    <>
      {model.edges.map((e) => (
        <Polyline
          key={e.key}
          positions={e.positions}
          pathOptions={e.onPath ? STYLE_EDGE_PATH : STYLE_EDGE_SUBTLE}
        />
      ))}
      {model.nodes.map((n) => (
        <CircleMarker
          key={`n-${n._key}`}
          center={[n.lat, n.lng]}
          pathOptions={n.onPath ? STYLE_NODE_PATH : STYLE_NODE_SUBTLE}
          radius={n.onPath ? STYLE_NODE_PATH.radius : STYLE_NODE_SUBTLE.radius}
        >
          <Popup>
            <strong>{n.nombre || n.id || n._key}</strong>
            {n.nombre && n.id && n.nombre !== n.id ? (
              <>
                <br />
                Id: {n.id}
              </>
            ) : null}
            <br />
            {n.onPath ? 'Nodo en la ruta del grafo' : 'Nodo del grafo'}
            <br />
            {n.lat.toFixed(5)}, {n.lng.toFixed(5)}
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}
