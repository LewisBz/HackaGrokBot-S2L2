import { useEffect, useRef, useState, useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { lineaColor } from '../utils/lineaColor'

const BUSES_URL = '/api/buses'
const POLL_MS = 1500
const LERP_MS = 1200

function makeBusIcon(linea) {
  const c = lineaColor(linea)
  const short = (linea || '?').split('-')[0].slice(0, 4)
  return L.divIcon({
    className: 'bus-marker',
    html: `<div class="bus-dot" style="background:${c.bg};border-color:${c.border};color:${c.text}">${short}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function MovingBusMarker({ bus, icon }) {
  const targetRef = useRef([bus.lat, bus.lng])
  const posRef = useRef([bus.lat, bus.lng])
  const [pos, setPos] = useState([bus.lat, bus.lng])
  const raf = useRef(0)

  useEffect(() => {
    const next = [bus.lat, bus.lng]
    const prev = targetRef.current
    const dist = Math.abs(next[0] - prev[0]) + Math.abs(next[1] - prev[1])
    targetRef.current = next

    if (dist < 1e-7) {
      posRef.current = next
      setPos(next)
      return undefined
    }

    const from = posRef.current
    const start = performance.now()
    cancelAnimationFrame(raf.current)

    const tick = (now) => {
      const t = Math.min(1, (now - start) / LERP_MS)
      const e = 1 - (1 - t) * (1 - t)
      const lat = from[0] + (next[0] - from[0]) * e
      const lng = from[1] + (next[1] - from[1]) * e
      const cur = [lat, lng]
      posRef.current = cur
      setPos(cur)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [bus.lat, bus.lng])

  return (
    <Marker position={pos} icon={icon}>
      <Popup>
        <strong>GPS {bus.id}</strong>
        <br />
        Línea: {bus.linea}
        <br />
        {(bus.viene_de || bus.origen_linea || '—')} →{' '}
        {(bus.hacia || bus.destino_linea || '—')}
        {bus.next_stop ? (
          <>
            <br />
            Próxima: {bus.next_stop}
          </>
        ) : null}
        {bus.speed_kmh != null ? (
          <>
            <br />
            {bus.speed_kmh} km/h
          </>
        ) : null}
      </Popup>
    </Marker>
  )
}

export default function BusLayer({ onStatus }) {
  const [buses, setBuses] = useState([])
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false

    async function pull() {
      try {
        const res = await fetch(BUSES_URL)
        if (!res.ok) {
          if (!cancelled.current) onStatus?.({ ok: false, count: 0 })
          return
        }
        const data = await res.json()
        if (cancelled.current) return
        if (Array.isArray(data)) {
          setBuses(data)
          onStatus?.({ ok: true, count: data.length })
        } else {
          onStatus?.({ ok: false, count: 0 })
        }
      } catch {
        if (!cancelled.current) onStatus?.({ ok: false, count: 0 })
      }
    }

    pull()
    const id = setInterval(pull, POLL_MS)
    return () => {
      cancelled.current = true
      clearInterval(id)
    }
  }, [onStatus])

  const icons = useMemo(() => {
    const map = {}
    for (const b of buses) {
      if (b.linea != null && !map[b.linea]) map[b.linea] = makeBusIcon(b.linea)
    }
    return map
  }, [buses])

  return (
    <>
      {buses.map((b) => (
        <MovingBusMarker
          key={b.id}
          bus={b}
          icon={icons[b.linea] || makeBusIcon(b.linea)}
        />
      ))}
    </>
  )
}
