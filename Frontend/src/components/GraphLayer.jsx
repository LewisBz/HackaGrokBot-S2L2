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

/** Normalize API tipo → troncal | barrio | poi (unknown/missing → barrio). */
function normalizeTipo(raw) {
  if (raw == null || String(raw).trim() === '') return 'barrio'
  const t = String(raw).trim().toLowerCase()
  if (t === 'troncal') return 'troncal'
  if (t === 'poi') return 'poi'
  if (t === 'barrio') return 'barrio'
  return 'barrio'
}

const TIPO_STYLE = {
  troncal: {
    radius: 7,
    color: '#ea580c',
    weight: 2,
    fillColor: '#f97316',
    fillOpacity: 0.92,
    edge: '#f97316',
    edgeWeight: 2,
    label: 'Troncal',
  },
  barrio: {
    radius: 5,
    color: '#64748b',
    weight: 1.25,
    fillColor: '#94a3b8',
    fillOpacity: 0.8,
    edge: '#94a3b8',
    edgeWeight: 1.25,
    label: 'Barrio',
  },
  poi: {
    radius: 5.5,
    color: '#0d9488',
    weight: 1.5,
    fillColor: '#2dd4bf',
    fillOpacity: 0.88,
    edge: '#14b8a6',
    edgeWeight: 1.5,
    label: 'POI',
  },
}

const STYLE_EDGE_PATH = {
  color: '#2563eb',
  weight: 5,
  opacity: 0.95,
}

const STYLE_NODE_PATH = {
  radius: 9,
  color: '#1d4ed8',
  weight: 3,
  fillColor: '#3b82f6',
  fillOpacity: 1,
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
  const kind = tipo === 'troncal' || tipo === 'poi' ? tipo : 'barrio'
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
 * Colorea por tipo (troncal | barrio | poi); Tooltip hover + Popup click.
 * Etiqueta permanente opcional solo en nodos del camino.
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

    const typed = new Map()
    for (const [k, n] of byKey) {
      typed.set(k, { ...n, tipo: normalizeTipo(n.tipo) })
    }

    const edges = []
    for (let i = 0; i < aristas.length; i++) {
      const e = aristas[i]
      const [a, b] = edgeEnds(e)
      const na = a && typed.get(a)
      const nb = b && typed.get(b)
      if (!na || !nb) continue
      const onPath = hasPath && highlightEdges.has(`${a}|${b}`)
      const bothTroncal = na.tipo === 'troncal' && nb.tipo === 'troncal'
      const style = bothTroncal
        ? TIPO_STYLE.troncal
        : TIPO_STYLE[na.tipo] || TIPO_STYLE.barrio
      edges.push({
        key: `e-${a}-${b}-${i}`,
        positions: [
          [na.lat, na.lng],
          [nb.lat, nb.lng],
        ],
        onPath,
        edgeColor: style.edge,
        weight: style.edgeWeight,
      })
    }

    if (camino?.aristas) {
      for (let i = 0; i < camino.aristas.length; i++) {
        const e = camino.aristas[i]
        const [a, b] = edgeEnds(e)
        const na = a && typed.get(a)
        const nb = b && typed.get(b)
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
            edgeColor: STYLE_EDGE_PATH.color,
            weight: STYLE_EDGE_PATH.weight,
          })
        }
      }
    }

    edges.sort((a, b) => Number(a.onPath) - Number(b.onPath))

    const nodes = [...typed.values()].map((n) => ({
      ...n,
      onPath: hasPath && highlightNodes.has(n._key),
      label: n.nombre || n.id || n._key,
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
        const tipo = TIPO_STYLE[n.tipo] || TIPO_STYLE.barrio
        const opts = n.onPath
          ? STYLE_NODE_PATH
          : {
              color: tipo.color,
              weight: tipo.weight,
              fillColor: tipo.fillColor,
              fillOpacity: tipo.fillOpacity,
            }
        const radius = n.onPath ? STYLE_NODE_PATH.radius : tipo.radius
        return (
          <CircleMarker
            key={`n-${n._key}`}
            center={[n.lat, n.lng]}
            pathOptions={opts}
            radius={radius}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              <span className="graph-node-tooltip">
                {n.label}
                <span className="graph-node-tooltip-kind">
                  {' '}
                  · {tipo.label}
                </span>
              </span>
            </Tooltip>
            <Popup>
              <div className="graph-node-popup">
                <strong>{n.label}</strong>
                <div className="graph-node-popup-kind">{tipo.label}</div>
              </div>
            </Popup>
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
