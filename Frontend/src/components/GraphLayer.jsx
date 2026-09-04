import { useMemo } from 'react'
import { CircleMarker, Polyline, Popup } from 'react-leaflet'

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

const STYLE_EDGE_BASE = {
  color: '#94a3b8',
  weight: 2,
  opacity: 0.55,
}

const STYLE_EDGE_PATH = {
  color: '#2563eb',
  weight: 5,
  opacity: 0.95,
}

const STYLE_NODE_BASE = {
  radius: 5,
  color: '#64748b',
  weight: 1,
  fillColor: '#cbd5e1',
  fillOpacity: 0.7,
}

const STYLE_NODE_PATH = {
  radius: 8,
  color: '#1d4ed8',
  weight: 2,
  fillColor: '#2563eb',
  fillOpacity: 0.95,
}

/**
 * Dibuja el grafo completo y resalta el camino Dijkstra.
 * @param {{ nodos?: any[], aristas?: any[] } | null} grafo — grafo completo (GET /api/grafo)
 * @param {{ nodos?: any[], aristas?: any[] } | null} camino — subgrafo del camino (response.grafo)
 */
export default function GraphLayer({ grafo, camino }) {
  const model = useMemo(() => {
    if (!grafo || typeof grafo !== 'object') return null
    const nodos = Array.isArray(grafo.nodos) ? grafo.nodos : []
    const aristas = Array.isArray(grafo.aristas) ? grafo.aristas : []
    if (!nodos.length && !aristas.length) return null

    const byKey = buildLookup(nodos)
    // Permitir coords del camino si faltan en el grafo base
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

    // Aristas del camino que no estén en el grafo base
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
          (x) => x.key.startsWith(`e-${a}-${b}-`) || x.key.startsWith(`e-${b}-${a}-`),
        )
        if (existsBase) {
          for (const x of edges) {
            if (x.key.startsWith(`e-${a}-${b}-`) || x.key.startsWith(`e-${b}-${a}-`)) {
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

    // Base edges first, then path on top (render order)
    edges.sort((a, b) => Number(a.onPath) - Number(b.onPath))

    const nodes = [...byKey.values()].map((n) => ({
      ...n,
      onPath: hasPath && highlightNodes.has(n._key),
    }))

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
      {model.nodes.map((n) => (
        <CircleMarker
          key={`n-${n._key}`}
          center={[n.lat, n.lng]}
          pathOptions={n.onPath ? STYLE_NODE_PATH : STYLE_NODE_BASE}
          radius={n.onPath ? STYLE_NODE_PATH.radius : STYLE_NODE_BASE.radius}
        >
          <Popup>
            <strong>{n.nombre || n.id || n._key}</strong>
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}
