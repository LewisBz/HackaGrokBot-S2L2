/** Stable HSL color from a linea string (same linea → same color). */
export function lineaColor(linea) {
  const s = String(linea || '?')
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  const sat = 62 + (hash % 18)
  const light = 42 + ((hash >> 8) % 12)
  return {
    hue,
    bg: `hsl(${hue} ${sat}% ${light}%)`,
    border: `hsl(${hue} ${sat}% ${Math.max(22, light - 18)}%)`,
    text: light < 48 ? '#fff' : '#111827',
    accent: `hsl(${hue} ${sat}% ${light}%)`,
  }
}
