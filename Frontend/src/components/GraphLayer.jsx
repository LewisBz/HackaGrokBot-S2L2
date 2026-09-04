import { useMemo } from 'react'
import { CircleMarker, Polyline, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useState } from 'react'

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
    byKey.set(k, { ...n, _key: k, lat, lng, tipo: n.tipo || 'poi' })
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

const TIPO_STYLE = {
  troncal: {
    color: '#0f766e',
    fillColor: '#14b8a6',
    edge: '#14b8a6',
    radius: 4.5,
  },
  barrio: {
    color: '#b45309',
    fillColor: '#f59e0b',
    edge: '#94a3b8',
    radius: 4,
  },
  poi: {
    color: '#334155',
    fillColor: '#94a3b8',
    edge: '#64748b',
    radius: 4,
  },
}

const STYLE_EDGE_PATH = {
  color: '#38bdf8',
  weight: 4,
  opacity: 0.95,
}

const STYLE_NODE_PATH = {
  radius: 7,
  color: '#0284c7',
  weight: 2,
  fillColor: '#38bdf8',
  fillOpacity: 0.95,
}

function shortLabel(name) {
  if (!name) return ''
  if (name.length <= 14) return name
  return `${name.slice(0, 12)}…`
}

function ZoomTracker({ onZoom }) {
  const map = useMap()
  useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  })
  return null
}

/**
 * Dibuja el grafo completo y resalta el camino Dijkstra.
 * Colorea por tipo (troncal | barrio | poi); etiquetas solo al acercar.
 */
export default function GraphLayer({ grafo, camino }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())

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
        byKey.set(k, { ...n, _key: k, lat, lng, tipo: n.tipo || 'poi' })
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
      const bothTroncal = na.tipo === 'troncal' && nb.tipo === 'troncal'
      const edgeColor = bothTroncal
        ? TIPO_STYLE.troncal.edge
        : TIPO_STYLE[na.tipo]?.edge || TIPO_STYLE.poi.edge
      edges.push({
        key: `e-${a}-${b}-${i}`,
        positions: [
          [na.lat, na.lng],
          [nb.lat, nb.lng],
        ],
        onPath,
        edgeColor,
        weight: bothTroncal ? 2 : 1.25,
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
            edgeColor: STYLE_EDGE_PATH.color,
            weight: STYLE_EDGE_PATH.weight,
          })
        }
      }
    }

    edges.sort((a, b) => Number(a.onPath) - Number(b.onPath))

    const nodes = [...byKey.values()].map((n) => ({
      ...n,
      onPath: hasPath && highlightNodes.has(n._key),
    }))

    return { nodes, edges }
  }, [grafo, camino])

  if (!model) return null

  const showLabels = zoom >= 14
  const showMajorLabels = zoom >= 13

  return (
    <>
      <ZoomTracker onZoom={setZoom} />
      {model.edges.map((e) => (
        <Polyline
          key={e.key}
          positions={e.positions}
          pathOptions={
            e.onPath
              ? STYLE_EDGE_PATH
              : {
                  color: e.edgeColor,
                  weight: e.weight,
                  opacity: 0.55,
                }
          }
        />
      ))}
      {model.nodes.map((n) => {
        const tipo = TIPO_STYLE[n.tipo] || TIPO_STYLE.poi
        const isMajor = n.tipo === 'troncal' || n.onPath
        const labelOk =
          n.onPath || (showLabels && isMajor) || (showMajorLabels && isMajor) || showLabels
        return (
          <CircleMarker
            key={`n-${n._key}`}
            center={[n.lat, n.lng]}
            pathOptions={
              n.onPath
                ? STYLE_NODE_PATH
                : {
                    color: tipo.color,
                    weight: 1,
                    fillColor: tipo.fillColor,
                    fillOpacity: 0.85,
                  }
            }
            radius={n.onPath ? STYLE_NODE_PATH.radius : tipo.radius}
          >
            {labelOk && (
              <Tooltip
                permanent={n.onPath || (showLabels && isMajor)}
                direction="top"
                offset={[0, -6]}
                className="graph-node-label"
                opacity={0.9}
              >
                {shortLabel(n.nombre || n.id || n._key)}
              </Tooltip>
            )}
            <Popup>
              <strong>{n.nombre || n.id || n._key}</strong>
              <br />
              <span className="popup-tipo">{n.tipo || 'poi'}</span>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
