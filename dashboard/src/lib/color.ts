// Hex → HSL helper for runtime theming.
// ES: Las CSS variables guardan tripletas HSL (ej. "207 100% 40%") para usarse como
//     hsl(var(--primary)). El color picker entrega hex; lo convertimos al aplicar.
// EN: CSS variables store HSL triplets so they plug into hsl(var(--x)). The picker
//     returns hex; we convert when applying.

export function hexToHslTriplet(hex: string): string | null {
  const clean = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
